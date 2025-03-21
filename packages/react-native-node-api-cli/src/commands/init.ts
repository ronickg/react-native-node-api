import fs from 'node:fs/promises';
import { exec, execSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import chalk from 'chalk';
import { Command, Option } from 'commander';
import consola from 'consola';
import { input, checkbox } from '@inquirer/prompts';
import { detectPackageManager, ensureDependencyInstalled } from 'nypm';
import findUp from 'find-up';
import { guessTargetsFromPackageJson, SUPPORTED_TARGETS } from '../targets.js';
import { convertGypToCmakeJs } from '../gyp.js';
import type { GypFile, PackageJson } from '../types.js';

interface Options {
  verbose: boolean;
}

const command = new Command('init-module')
  .description('Initializes existing React Native library as a NodeAPI module')
  .addOption(new Option('-v, --verbose', 'Enable verbose output'));


function getPackageName(name: string) {
  if (name.startsWith('@')) {
    // Strip the package scope
    return name.substring(name.lastIndexOf('/') + 1);
  } else {
    return name;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(
    await fs.readFile(path, { encoding: 'utf-8' })
  ) as T;
}

async function writeJson<T>(path: string, value: T): Promise<void> {
  return fs.writeFile(
    path,
    JSON.stringify(value, null, 2)
  );
}

command.action(async (_options: Options) => {
  process.chdir('../../example-cpp-node-api-addon');

  // Find project root and read its `./package.json`
  const projectRoot = await findProjectRoot();
  consola.info(`Found project at ${chalk.dim(projectRoot)}`);
  const pkg = await readJson<PackageJson>(`${projectRoot}/package.json`);

  const pm = await detectPackageManager(process.cwd());
  if (!pm) {
    consola.error('Could not detect package manager');
    return;
  }
  consola.debug(`Detected package manager: ${pm.name} ${pm.version}`);

  // Guess the package name... Check if there's a gyp file, otherwise fallback to package.json
  let guessedPackageName = getPackageName(pkg.name);
  try {
    const gypFile = await readJson<GypFile>(`${projectRoot}/bindings.gyp`);
    if (gypFile.targets?.length === 1) {
      if (typeof gypFile.targets[0]?.target_name === 'string') {
        guessedPackageName = gypFile.targets[0]?.target_name || guessedPackageName;
      }
    }
  } catch { }

  // Infer the name of the addon from the package name (but without scope)
  const packageName = await input({
    message: 'Package name:',
    default: guessedPackageName,
  });

  // For which targets are we building?
  const guessedTargets = guessTargetsFromPackageJson(pkg);
  const userTargets = await checkbox({
    message: 'Choose target(s) to build your Node-API addon to:',
    choices: Object.keys(SUPPORTED_TARGETS).map(target => ({
      name: target,
      value: target,
      checked: guessedTargets.includes(target),
    })),
  });
  consola.info('Selected targets:', userTargets);
  const buildTargets = userTargets
    .map(name => SUPPORTED_TARGETS[name]!)
    .map(target => ({
      ...target,
      targetId: [target.os, target.cpu, target?.variant].filter(v=>v).join('-'),
    }));

  // Update our `package.json` by adding `napi`
  pkg['napi'] = {
    name: packageName,
    triples: {
      additional: userTargets,
    },
  };
  await writeJson<PackageJson>(`${projectRoot}/package.json`, pkg);

  await ensureDependencyInstalled('cmake-js', { dev: true });

  // Create subpackages for each target, just like napi-rs
  buildTargets.forEach(async target => {
    // createSubpackageForTarget(pkg, target);
    const targetDir = `${projectRoot}/npm/${target.targetId}`;
    await fs.mkdir(targetDir, { recursive: true });
    // Write their `package.json` file (just like napi-rs does)
    await writeJson<PackageJson>(
      `${targetDir}/package.json`,
      {
        name: `${packageName}-${target.targetId}`,
        version: pkg.version,
        os: target.os,
        cpu: target.cpu,
        main: `${packageName}.${target.targetId}.node`,
        files: [
          `${packageName}.${target.targetId}.node`,
        ],
        engines: pkg.engines,
      },
    );
  });

  // Install our "build" script in package.json
  const cmakeSrc = await convertGypToCmakeJs(`${projectRoot}/bindings.gyp`, packageName);
  if (cmakeSrc) {
    fs.writeFile(`${projectRoot}/CMakeLists.txt`, cmakeSrc);
  }

  // Try to build...
  buildTargets.forEach(target => {
    const targetDir = `${projectRoot}/npm/${target.targetId}`;

    const sysroot = execSync(`xcrun -sdk ${target.apple?.sdk} --show-sdk-path`).toString().trim();

    const appleCpus = target.cpu.map(cpu => {
      switch (cpu) {
        case 'x64': return 'x86_64';
        case 'arm64': return 'arm64';
        default: return undefined;
      }
    }).filter(cpu => cpu !== undefined);

    const buildCmd = [
      'npx', 'cmake-js', 'compile', `--out=${targetDir}/build`,
      `--CDCMAKE_OSX_SYSROOT=${sysroot}`,
      `--CDADDON_TARGET_PLATFORM="${target.apple.target}"`,
      `--CDCMAKE_OSX_ARCHITECTURES:STRING="${appleCpus.join(';')}"`,
      `--CDCMAKE_OSX_DEPLOYMENT_TARGET:STRING="${target.apple.target}"`,
      `--CDRELEASE_VERSION="${pkg.version}"`,
    ].join(' ');
    const buildOutput = execSync(buildCmd).toString();
    console.info('Build output:', buildOutput);
  });

  // -- once everything is built, we can create a xcframework (for apple libs)
  const appleLibs: string[] = buildTargets
    .filter(t => t.apple)
    .map(t => `${projectRoot}/npm/${t.targetId}/build/Release/${packageName}.dylib`);
  const xcframeworkCmd = [
    'xcodebuild', '-create-xcframework',
    ...appleLibs.flatMap(lib => ['-library', lib]),
    '-output', `xcframeworks/${packageName}.xcframework`,
  ].join(' ');
  const xcframeworkOutput = execSync(xcframeworkCmd).toString();
});


/**
 * Finds project directory that contains a `package.json`.
 *
 * @throws UnknownProjectError If no package.json was found
 * @param from Directory path to start looking from, default to current directory
 */
export async function findProjectRoot(
  from: string = process.cwd()
): Promise<string> {
  const packageJsonPath = await findUp('package.json', { cwd: from });
  if (!packageJsonPath) {
    throw new Error('Could not locate package.json');
  }
  return path.dirname(packageJsonPath);
}

export default command;
