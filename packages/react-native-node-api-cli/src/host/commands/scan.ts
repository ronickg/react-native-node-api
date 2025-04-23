import { Command, Option } from 'commander';
import { chalk, consola, checkbox, oraPromise } from '../../common/tui.js';
import { globby } from 'globby';
import { findProjectRoot, readJson, writeJson } from '../../common/project.js';
import { groupBy, rpartition } from '../../common/utils.js';
import type { NapiHostConfig } from '../../types.js';
import { getSearchPathsForTargets, getTargetsFor } from '../utils.js';

interface Options {
  update?: boolean;
  all?: boolean;
}

function replacePlaceholders(mapping: Record<string, string>, inputStr: string) { // TESTED: works
  return Object.entries(mapping).reduce(
    (str, [placeholder, value]) => str.replaceAll(placeholder, value),
    inputStr
  );
}

const command = new Command('scan')
  .description('Scans dependencies searching for Node-API addons')
  .addOption(new Option('-u, --update', 'Automatically update configuration file'))
  .addOption(new Option('-a, --all', 'Add all found modules (without asking)'))
  .action(async (_options: Options) => {
    process.chdir('../../apps/example-rnta'); // HACK

    // Find project root and read its `./package.json`
    const projectRoot = await findProjectRoot();
    consola.log(`Found project at ${chalk.dim(projectRoot)}`);

    let configJson: JsonFile<NapiHostConfig>;
    try {
      configJson = await readJson(`${projectRoot}/napi-host.config.json`);
    } catch {
      consola.error('Failed to open "napi-host.config.json" file! Have you run "renapi init-host" before?');
      return;
    }
    const hostConfig = configJson.data!;

    // Q: Which directories should I search?
    //    - What are we even looking for? Files with `.node` extension?
    //      - What if some addons do not use this extension? Examples?
    // A: Expose this via config file (with sane default), giving user full control

    // Before we begin, we need to resolve the placeholders in the search paths.
    // We support following: `{configuration}`, `{platform}` and `{arch}` (maybe `{node_abi}` number as well?)
    const targets = getTargetsFor(hostConfig.platforms, hostConfig.archs);

    const searchPaths = getSearchPathsForTargets(hostConfig.searchPaths.addons, targets);

    // - First and foremost, packages that we explicitly opted in (look for `napi` config object)
    const matches = await oraPromise(() => globby(searchPaths), 'Scanning for node addons...');

    // We can try to merge the matches by collapsing the '{platform}` and `{arch}` and grouping the entries.
    // For now we look for:
    // `**/{platform}-{arch}/` directory
    // `**/*-{platform}-{arch}/` directory
    // `*.{platform}-{arch}.node` file
    // `*-{platform}-{arch}.node` file
    const targetsOptions = targets.map(([platform, arch]) => `${platform}-${arch}`).join('|');
    const targetFilePattern = new RegExp(`([\\.-])(${targetsOptions}).node$`);
    const targetDirPattern = new RegExp(`([\/-])(${targetsOptions})\/`, 'g');
    const flatMatchesMap = groupBy(matches,
      (path) => path
        .replaceAll(targetDirPattern, '$1{platform}-{arch}/')
        .replace(targetFilePattern, '$1{platform}-{arch}.node')
    );

    // Q: Should we specify which platforms are we interested in?
    //    - For `react-native` we have: `ios` and `android`
    //      - ios => we need to build xcframework and update podspec
    //      - android => ?
    //    - For `react-native-windows` we have: `windows`
    //      => ?
    //    - For `react-native-macos` we have: `macos`
    //      - we can use `dylib` directly or build `xcframework`
    // A: Specify it in the config file (gives us full control)

    // NOTE: To avoid (deeply) inspecting the addons in this early release
    // we rely on a simple herustic that all supported Node-API addons have
    // the "platform" indicator in their name (suffix) or they are located
    // in a directory named after the platform/target. This makes the whole
    // scan and discovery easier and more predictable. The third option can
    // be checking the `os` and ``package.json`.
    //
    // `napi-rs` used `.darwin-arm64.node` extension, which basically is `.{os}-{cpu}.node`.
    // In the generated `npm` directory, it created:
    //   - `android-arm64`
    //   - `darwin-arm64`
    //   - `darwin-x64`
    //   - `linux-x64-gnu`
    //   - `win32-x64-msvc`
    // This naming follows what Node.js will understand in `package.json`,
    // meaning that we would need to be able to map those.
    //
    // `node-pre-gyp` (https://nodeaddons.com/cross-platform-addons-with-node-pre-gyp/)
    // automatically names built addon executables based on the current platform (OS),
    // architecture (i.e. x64) and Node.js version.
    // NOTE: `binding.gyp` can also have conditions, eg. per OS...
    //
    // We should allow to specify placeholders, like:
    // - `{configuration}` which is one of: `Debug`, `Release`
    // - `{platform}` which in Node.js lingo (`process.platform`) is OS, like: `darwin`, `linux`, `win32` (TODO: The `package.json` calls it `os`)
    // - `{arch}` which is Node.js `process.arch`, like: `x64`, `ia32`
    // - `{version}` which is the version of your addon (derived from package.json)
    // - `{node_abi}`
    //
    // Also look at prebuild (https://github.com/prebuild/prebuild) which works with `node-gyp`
    // but it also supports CMake.js with `--backend cmake-js`.
    // This tool also uses `binary` key in `package.json` like this:
    //    {
    //      "binary": {
    //        "napi_versions": [2,3]
    //      }
    //    }
    //
    // Yet another tool: https://github.com/prebuild/prebuildify which states somewhere at the end
    // of it's README file that:
    //    > For example on Linux x64 prebuilds end up in `prebuilds/linux-x64`.
    //    > The arch option can also be a multi-arch value separated by `+` (for example `x64+arm64` for a universal binary) [...]

    const selectedAddons = await checkbox({
      message: 'Choose addons to include in your React Native app:',
      choices: Object.entries(flatMatchesMap).map(([group, paths]) => {
        const [dirName, baseName] = rpartition('/', group);
        return {
          name: `${baseName} (from ${dirName})`,
          value: group,
          checked: hostConfig.modules.includes(group) || paths.some((path) => hostConfig.modules.includes(path)),
          };
      }),
    });

    consola.box(['Selected addons:', ...selectedAddons].join('\n'));

    // - Moreover, packages can be "lifted" in monorepo configurations...

    // Write / update configuration files
    configJson.data.modules = selectedAddons;
    await writeJson(`${projectRoot}/napi-host.config.json`, configJson);
});

export default command;
