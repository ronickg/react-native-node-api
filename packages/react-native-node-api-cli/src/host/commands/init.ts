import { Command, Option } from 'commander';
import { chalk, consola, checkbox } from '../../common/tui.js';
import type { NapiHostConfig, PackageJson } from '../../types.js';
import { findProjectRoot, readJson, writeJson } from '../../common/project.js';

interface Options {
  verbose?: boolean;
}

const knownPlatformsForDeps = {
  '@react-native-community/cli-platform-android': ['android'],
  '@react-native-community/cli-platform-ios': ['ios'],
  'react-native': ['ios', 'android'],
  'react-native-tvos': ['ios', 'android', 'tvos'],
  'react-native-windows': ['win32'],
  'react-native-visionos': ['visionos'],
  'react-native-macos': ['darwin', 'macos'],
};

const ALL_PLATFORMS = ['android', 'ios', 'tvos', 'watchos', 'visionos', 'macos', 'win32'];
const ALL_ARCHS = ['arm64', 'x64', 'ia32'];

const command = new Command('init-host')
  .description('Initializes existing React Native app to host NodeAPI modules')
  .addOption(new Option('-v, --verbose', 'Enable verbose output'))
  .action(async (_options: Options) => {
    // Find project root and read its `./package.json`
    const projectRoot = await findProjectRoot();
    consola.info(`Found project at ${chalk.dim(projectRoot)}`);
    const pkgFile = await readJson<PackageJson>(`${projectRoot}/package.json`);

    // We need to guess for which platforms the user would like to target...
    // TODO: If there is a test runner (eg. `jest`) should we also build for host?
    const dependencies = {
      ...(pkgFile.data.devDependencies),
      ...(pkgFile.data.dependencies),
    };
    const guessedPlatforms = new Set(
      Object.entries(knownPlatformsForDeps)
        .filter(([name, _]) => Object.hasOwn(dependencies, name))
        .flatMap(([_, platforms]) => platforms)
    );
    const selectedPlatforms = await checkbox({
      message: 'Which platform do you want to build for?',
      choices: ALL_PLATFORMS.map(name => ({
        name: name,
        value: name,
        checked: guessedPlatforms.has(name),
      })),
    });

    // Now, once we know which platforms (teoretically) we are aiming,
    // we should somehow lookup which architectures we need to build...
    const guessedArchs = selectedPlatforms.includes('win32')
      ? ['arm64', 'x64']
      : ['arm64']; // HACK: Hardcoded CPU arch; we should infer it instead
    const selectedArchs = await checkbox({
      message: 'Which architectures do you want to build for?',
      choices: ALL_ARCHS.map(name => ({
        name: name,
        value: name,
        checked: guessedArchs.includes(name),
      })),
    });

    // At the end this command should generate a napi-host.config.json file.
    const initialConfig: NapiHostConfig = {
      platforms: selectedPlatforms,
      archs: selectedArchs,
      searchPaths: {
        addons: [
          // '../../packages/**/*.node',
          './**/*.node',
        ],
        patterns: [
          '*.{platform}-{arch}.node',
          '*-{platform}-{arch}.node',
          '{platform}-{arch}/*.node',
          '*-{platform}-{arch}/*.node',
        ],
      },
      modules: []
    };
    await writeJson(`${projectRoot}/napi-host.config.json`, {
      data: initialConfig,
      indent: 2,
    });

    // TODO: I guess we have to reinstall `hermes-engine` to use our modified version
});

export default command;
