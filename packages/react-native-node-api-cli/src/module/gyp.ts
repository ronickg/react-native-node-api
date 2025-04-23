import fs from 'node:fs/promises';
import consola from 'consola';
import type { GypFile } from '../types.js';

function indent(size: number = 2, character: string = ' ') {
  return (t: string) => character.repeat(size) + t;
}

function isCmdExpansion(value: string)
{
  const trimmedValue = value.trim();
  return trimmedValue.startsWith('<!')
}

export async function convertGypToCmakeJs(gypFilePath: string, projectName: string)
{
  let napiVersion: number = 4; // TODO: Read this from package.json?

  try {
    // Load and parse the JSON-like Gyp file
    const data = await fs.readFile(gypFilePath, 'utf-8');
    const gypData = JSON.parse(data) as GypFile;
    const targets = gypData.targets || [];

    if (targets.length === 0) {
      consola.error('No targets found in bindings.gyp');
      return;
    }

    // Start with a standard CMake "preamble"
    let cmakeSrc: string[] = [
      'cmake_minimum_required(VERSION 3.15)',
      `cmake_policy(SET CMP0091 NEW)`,
      `cmake_policy(SET CMP0042 NEW)`,
      '',
      `project(${projectName})`,
    ];

    targets.forEach(target => {
      const targetName = target.target_name;
      const sources = target.sources || [];
      let includeDirs = target['include_dirs!'] || target['include_dirs'] || [];
      const defines = target.defines || [];
      const cflags = target['cflags!'] || target['cflags'] || [];
      const cflags_cc = target['cflags_cc!'] || target['cflags_cc'] || [];
      const ldflags = target['ldflags!'] || target['ldflags'] || [];
      const ldflags_cc = target['ldflags_cc!'] || target['ldflags_cc'] || [];

      // Filter out variable expansions
      includeDirs = includeDirs.filter((v) => !isCmdExpansion(v));

      if (sources.length === 0) {
        consola.warn(`Target ${targetName} has no sources! Skipping...`);
        return;
      }
      cmakeSrc.push(
        '',
        `add_library(${targetName} SHARED`,
          ...[
            '${CMAKE_JS_SRC}',
            ...sources,
          ].map(indent()),
        `)`,
      );

      cmakeSrc.push(
        `target_compile_definitions(${targetName} PRIVATE`,
        ...[
          `NAPI_VERSION=${napiVersion}`,
          ...defines,
        ].map(indent()),
        ')',
      );

      cmakeSrc.push(
        `set_target_properties(${targetName} PROPERTIES`,
          ...[
            'CXX_STANDARD 11',
            'CXX_STANDARD_REQUIRED YES',
            'CXX_EXTENSIONS NO',
            'PREFIX ""',
            'SUFFIX ".node"',
          ].map(indent()),
        ')',
      );

      cmakeSrc.push(
        `target_include_directories(${targetName} PRIVATE`,
          ...[
            '${CMAKE_JS_INC}',
            ...includeDirs,
          ].map(indent()),
        ')',
      );

      cmakeSrc.push(
        `target_link_libraries(${targetName} \${CMAKE_JS_LIB})`
      );
    });

    // Finishing touches
    cmakeSrc.push(
      '',
      'if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)',
      ...[
        '# Generate node.lib',
        'execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})',
      ].map(indent()),
      'endif()',
    );

    return cmakeSrc.join('\n') + '\n';
  }
  catch (err) {
    consola.error(`Failed to load ${gypFilePath} file: ${err}`);
    return null;
  }
}
