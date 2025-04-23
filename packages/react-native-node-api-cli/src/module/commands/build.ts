import fs from 'node:fs/promises';
import { Command, Option } from 'commander';
import { chalk, consola, oraPromise } from '../../common/tui.js';
import { DEFAULT_TARGET_TRIPLES, SUPPORTED_TARGETS } from '../../targets.js';
import type { NapiConfig, PackageJson } from '../../types.js';
import { execa } from '../../common/utils.js';
import { findProjectRoot, readJson, writeJson } from '../../common/project.js';

interface Options {
  verbose?: boolean;
}

async function buildTargetWithCmakeJs(projectRoot: string, pkgVersion: string, target) {
  const targetDir = `${projectRoot}/npm/${target.targetId}`;

  const { stdout: sysroot } = await execa('xcrun', ['-sdk', target.apple?.sdk, '--show-sdk-path']);

  const appleCpus = target.cpu.map(cpu => {
    switch (cpu) {
      case 'x64': return 'x86_64';
      case 'arm64': return 'arm64';
      default: return undefined;
    }
  }).filter(cpu => cpu !== undefined);

  const buildCmdArgs = [
    'cmake-js', 'compile', `--out=${targetDir}/build`,
    `--CDCMAKE_OSX_SYSROOT=${sysroot}`,
    `--CDADDON_TARGET_PLATFORM="${target.apple.target}"`,
    `--CDCMAKE_OSX_ARCHITECTURES:STRING="${appleCpus.join(';')}"`,
    // `--CDCMAKE_OSX_DEPLOYMENT_TARGET:STRING="${target.apple.target}"`,
    `--CDRELEASE_VERSION="${pkgVersion}"`,
    // `--CDCMAKE_SYSTEM_NAME="$6"`,
    // `--CDCMAKE_XCODE_ATTRIBUTE_ENABLE_BITCODE:BOOLEAN="$enable_bitcode"`,
    // `--CDCMAKE_BUILD_TYPE="$BUILD_TYPE"`,
  ];
  await execa('npx', buildCmdArgs);
}

async function buildXcframework(projectRoot: string, packageName: string, buildTargets) {
  const outputDir = `xcframeworks/${packageName}.xcframework`;
  try {
    // HACK: `-create-xcframework` fails when libraries already exist, so we remove them...
    // TODO: Instead of removing whole xcframework we should only remove what we are adding?
    if ((await fs.lstat(outputDir)).isDirectory()) {
      await fs.rm(outputDir, { recursive: true });
    }
  } catch {}

  const appleLibs: string[] = buildTargets
    .filter(t => t.apple)
    .map(t => `${projectRoot}/npm/${t.targetId}/build/Release/${packageName}.node`);

  // HACK: `-create-xcframework` is very picky about the file extensions, and `.node` doesn't work...
  //
  // NOTE: Actually this hack works even better than expected, as `-create-xcframework` recognizes
  //        the symlink and resolves it when writing `LibraryPath` (leaving the `BinaryPath` as symlink).
  //        We might exploit this behavior by removing any platform and arch identifiers from the symlink!
  const appleDylibs = await Promise.all(appleLibs.map(async path => {
    const dylibName = path.replace(/\.node$/, '.dylib');
    // NOTE: This symlink might already exist... Should we recreate it (what if user edits it?)
    try {
      await fs.symlink(path, dylibName);
    } catch {}
    return dylibName;
  }));

  // Build the XCFramework from the '.dylib' files
  // TODO: Replace the `dylib` with `framework` (or at least put the `dylib` into a `framework`)
  await execa('xcodebuild', [
    '-create-xcframework',
    ...appleDylibs.flatMap(lib => ['-library', lib]),
    '-output', outputDir,
  ]);

  // Remove the workaround symlinks...
  appleDylibs.map(async path => await fs.unlink(path));
}

async function generateNpmSubpackages(projectRoot: string, packageName: string, parentPkgJson: PackageJson, buildTargets) {
  return Promise.all(
    buildTargets.map(async target => {
      // createSubpackageForTarget(pkg, target);
      const targetDir = `${projectRoot}/npm/${target.targetId}`;
      await fs.mkdir(targetDir, { recursive: true });
      // Write their `package.json` file (just like napi-rs does)
      await writeJson<PackageJson>(
        `${targetDir}/package.json`,
        {
          data: {
            name: `${packageName}-${target.targetId}`,
            version: parentPkgJson.version,
            os: target.os,
            cpu: target.cpu,
            main: `${packageName}.${target.targetId}.node`,
            files: [
              `${packageName}.${target.targetId}.node`,
            ],
            engines: parentPkgJson.engines,
          },
          indent: 2,
        },
      );
    })
  );
}

const command = new Command('build')
  .description('Builds Node-API addons for React Native targets')
  .addOption(new Option('-v, --verbose', 'Enable verbose output'))
  .action(async (_options: Options) => {
    // Find project root and read its `./package.json`
    const projectRoot = await findProjectRoot();
    consola.info(`Found project at ${chalk.dim(projectRoot)}`);
    const pkgFile = await readJson<PackageJson>(`${projectRoot}/package.json`);

    const buildTargets = await oraPromise(
      async () => {
        // Make sure that the "napi" config object exists...
        if (!Object.hasOwn(pkgFile.data, 'napi') || !Object.hasOwn(pkgFile.data.napi!, 'triples')) {
          console.error('Project does not have "napi" config object. Make sure you ran "CLI init-module".');
          return;
        }
        const config: Readonly<NapiConfig> = pkgFile.data.napi!;

        const userTargets = config.triples?.additional ?? [];
        if (config.triples?.defaults !== false) {
          userTargets.push(...DEFAULT_TARGET_TRIPLES);
        }

        const buildTargets = userTargets
          .map(name => SUPPORTED_TARGETS[name]!)
          .map(target => ({
            ...target,
            targetId: [target.os, target.cpu, target?.variant].filter(v=>v).join('-'),
          }));
        return buildTargets;
      },
      'Collecting build targets...'
    ) ?? [];
    const packageName = pkgFile.data.napi!.name;

    // Try to detect what type of a project are we dealing with...
    {
      // Check dependencies for:
      // - node-addon-api       = C++ Addon
      // - node-api-headers     = Node-API C addon

      // Check for build tool:
      // - `cmake-js`           = C/C++ addon
      // - `node-gyp`           = C/C++ addon
      // - `@napi-rs/cli`       = Rust
    }

    await oraPromise(
      () => generateNpmSubpackages(projectRoot, packageName, pkgFile.data, buildTargets),
      `Generating npm subpackages for ${buildTargets.length} targets...`
    );

    await Promise.all(buildTargets.map(async target => await oraPromise(
      () => buildTargetWithCmakeJs(projectRoot, pkgFile.data.version, target),
      'Building node addon for target ' + target.targetId
    )));

    await oraPromise(
      () => buildXcframework(projectRoot, packageName, buildTargets),
      'Building XCFramework...'
    );
});

export default command;
