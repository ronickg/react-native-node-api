import fs from 'node:fs/promises';
import fs2 from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { Command, Option } from 'commander';
import { chalk, consola, input, checkbox, select, oraPromise } from '../../common/tui.js';
import { ensureDependencyInstalled } from 'nypm';
import { DEFAULT_TARGET_TRIPLES, guessTargetsFromPackageJson, SUPPORTED_TARGETS } from '../../targets.js';
import type { GypFile, NapiConfig, PackageJson } from '../../types.js';
import { findProjectRoot, getUnscopedPackageName, readJson, writeJson } from '../../common/project.js';
import { rpartition } from '../../common/utils.js';
import { convertGypToCmakeJs } from '../gyp.js';

interface Options {
  verbose?: boolean;
  example?: boolean;
}

async function fileExists(path: string) {
  try {
    return (await fs.lstat(path)).isFile();
  } catch {
    return false;
  }
}

async function downloadFile(fromUrl: string, to?: string): Promise<void> {
  const module = fromUrl.startsWith('https://') ? https : http;

  if (to === undefined) {
    const [_, fileName] = rpartition('/', fromUrl);
    if (!fileName) {
      throw Error('Cannot infer file name from URL. Please provide one explicitly!');
    }
    to = fileName;
  }

  return new Promise((resolve, reject) => {
    const file = fs2.createWriteStream(to);

    const request = module.get(fromUrl, res => {
      if (res.statusCode !== 200) {
        reject(`Failed to download file from ${fromUrl}: Got ${res.statusCode}`);
      }
      res.pipe(file);
    });

    file.on('finish', () => {
      file.close();
      resolve();
    });
    request.on('error', err => {
      reject(`Download failed: ${err}...`);
    });
    file.on('error', err => {
      reject(`Download failed: ${err}...`);
    });
  });
}

const exampleOptions = {
  napiC: {
    name: 'Node-API addon in C',
    value: 'napiC',
    generator: () => Promise.all([
      downloadFile('https://raw.githubusercontent.com/nodejs/node-addon-examples/refs/heads/main/src/1-getting-started/1_hello_world/napi/hello.c'),
      downloadFile('https://raw.githubusercontent.com/nodejs/node-addon-examples/refs/heads/main/src/1-getting-started/1_hello_world/napi/binding.gyp'),
    ]),
    deps: [
      { name: 'node-api-headers', type: 'dev' },
    ],
  },
  nodeAddonCpp: {
    name: 'Node Addons in C++',
    value: 'nodeAddonCpp',
    generator: () => Promise.all([
      downloadFile('https://raw.githubusercontent.com/nodejs/node-addon-examples/refs/heads/main/src/1-getting-started/1_hello_world/node-addon-api/hello.cc'),
      downloadFile('https://raw.githubusercontent.com/nodejs/node-addon-examples/refs/heads/main/src/1-getting-started/1_hello_world/node-addon-api/binding.gyp'),
    ]),
    deps: [
      { name: 'node-addon-api', type: 'dev' },
    ],
  },
  napiRs: {
    name: 'Node Addon in Rust (with napi-rs)',
    value: 'napiRs',
    generator: undefined,
    deps: [],
  },
};

// The `init-module` MUST:
// 1. Populate the `napi` config object in `package.json` as close to `napi-rs`
// 2. Ask user which targets they want to build
// 3. Be re-entrant; handle multiple invokations of `init-module` command
// 4. Make sure that all required dependencies are installed
//
// It would be good if:
// - This command would pick as much existing configuration as possible
const command = new Command('init-module')
  .description('Initializes existing React Native library as a NodeAPI module')
  .addOption(new Option('-v, --verbose', 'Enable verbose output'))
  .addOption(new Option('--example', 'Include example addon source code'))
  .action(async (options: Options) => {
    // Find project root and read its `./package.json`
    const projectRoot = await findProjectRoot();
    consola.info(`Found project at ${chalk.dim(projectRoot)}`);
    const pkgFile = await readJson<PackageJson>(`${projectRoot}/package.json`);
    const gypFilePath = `${projectRoot}/binding.gyp`;

    // Check, if `package.json` has a `napi` object created by napi-rs or by us.
    // If so, just use values from there and ask for missing ones.
    const config: Partial<NapiConfig> = { ...(pkgFile.data.napi) };

    if (!config.name) {
      // Guess the package name based on current configuration.
      // Try (in order): `gyp`'s target name -> `package.json`'s name.
      let guessedPackageName = getUnscopedPackageName(pkgFile.data.name);
      try {
        const gypFile = await readJson<GypFile>(gypFilePath);
        if (gypFile.data.targets?.length === 1) {
          if (typeof gypFile.data.targets[0]?.target_name === 'string') {
            guessedPackageName = gypFile.data.targets[0]?.target_name;
          }
        }
      } catch { }

      // Infer the name of the addon from the package name (but without scope)
      const packageName = await input({
        message: 'Package name:',
        default: guessedPackageName,
      });
      config.name = packageName;
    }

    // For which targets are we building?
    const guessedTargets = guessTargetsFromPackageJson(pkgFile.data);
    const selectedTargets = await checkbox({
      message: 'Choose target(s) to build your Node-API addon for:',
      choices: Object.keys(SUPPORTED_TARGETS).map(target => ({
        name: target,
        value: target,
        checked: guessedTargets.includes(target),
      })),
    });

    // Split selected targets to extra and default...
    const defaultTargets: string[] = [];
    const extraTargets: string[] = [];
    selectedTargets.forEach(target => {
      if (DEFAULT_TARGET_TRIPLES.includes(target)) {
        defaultTargets.push(target);
      } else {
        extraTargets.push(target);
      }
    });
    const usesAllDefault = (defaultTargets.length === DEFAULT_TARGET_TRIPLES.length);
    if (usesAllDefault) {
      config.triples = {
        ...(config.triples),
        defaults: true, // we explicitly set it to `true` (default)
        additional: extraTargets,
      };
    } else {
      config.triples = {
        ...(config.triples),
        defaults: false,
        additional: [
          ...defaultTargets,
          ...extraTargets,
        ],
      };
    }

    // Update our `package.json` by adding `napi` config object
    pkgFile.data.napi = config as NapiConfig;
    await writeJson<PackageJson>(`${projectRoot}/package.json`, pkgFile);

    if (options.example === true) {
      const selectedValue = await select({
        message: 'Select which example to generate:',
        choices: Object.values(exampleOptions),
      });
      const selected = exampleOptions[selectedValue]!;
      if (selected.generator !== undefined) {
        await oraPromise(async () => {
          await Promise.all(
            selected.deps.map(async (dep) => await ensureDependencyInstalled(dep.name, { dev: dep.type === 'dev' }))
          );
          await selected.generator();
        }, `Generating ${selected.name} example...`);
      }
    }

    // Ensure all needed dependencies are installed (added)
    await oraPromise(
      async () => {
        await ensureDependencyInstalled('cmake-js', { dev: true });
      },
      'Ensuring that required dependencies are installed...'
    );

    // TODO: Install our "build" script in package.json

    // Make sure that the `CMakeLists.txt` does NOT exist (we don't want to overwrite user changes...)
    if (await fileExists(gypFilePath) && !(await fileExists(`${projectRoot}/CMakeLists.txt`))) {
      await oraPromise(
        async () => {
          const cmakeSrc = await convertGypToCmakeJs(gypFilePath, config.name!);
          if (cmakeSrc) {
            fs.writeFile(`${projectRoot}/CMakeLists.txt`, cmakeSrc);
          }
        },
        'Generating CMakeLists.txt based on binding.gyp...'
      )
    }
});

export default command;
