import { Command, Option } from 'commander';
import { chalk, consola, oraPromise } from '../../common/tui.js';
import type { NapiHostConfig } from '../../types.js';
import { findProjectRoot, readJson, type JsonFile } from '../../common/project.js';
import { getSearchPathsForTargets, getTargetsFor, groupByPlatformArch, inferTargetTripletFromAddonPath, type Platform } from '../utils.js';
import { generatePodspecs } from '../../platform/apple/podspecs.js';
import { createXcframeworkFromDylibs } from '../../platform/apple/framework.js'

interface Options {
  verbose?: boolean;
}

const command = new Command('autolink')
  .description('TODO')
  .addOption(new Option('-v, --verbose', 'Enable verbose output'))
  .action(async (_options: Options) => {
    process.chdir('../../apps/example-rnta'); // HACK

    // Find project root and read its `./napi-host.config.json`
    const projectRoot = await findProjectRoot();
    consola.info(`Found project at ${chalk.dim(projectRoot)}`);

    let configJson: JsonFile<NapiHostConfig>;
    try {
      configJson = await readJson(`${projectRoot}/napi-host.config.json`);
    } catch {
      consola.error('Failed to open "napi-host.config.json" file! Have you run "renapi init-host" before?');
      return;
    }
    const hostConfig = configJson.data! as NapiHostConfig;

    // Collect all modules to be linked
    const targets = getTargetsFor(hostConfig.platforms ?? [], hostConfig.archs);
    const modulePaths = getSearchPathsForTargets(hostConfig.modules, targets);

    // TODO: We would need to assign those modules to the proper "backends", based on platform?
    // All apple platforms can be grouped together, as we still need to build XCFramework for them
    // and generate podspec in the same way for all of them...

    // We can try to classify the addons just by looking at the paths...
    // This way we would be able to dispatch such groups to the proper "generators"...
    const addonsPerTarget = groupByPlatformArch(modulePaths, inferTargetTripletFromAddonPath);

    await oraPromise(
      async () => generatePodspecs(addonsPerTarget),
      'Generating Podfile for host...',
    );

    // HACK: Testing with hardcoded paths
    const applePlatforms: Platform[] = ['ios'];
    const appleTargets = applePlatforms
      .flatMap(name => (name in addonsPerTarget) ? Object.values(addonsPerTarget[name]) : [])
      .flatMap(entry => entry);

    // Now create a "fat" xcframework from each addon dylib
    await oraPromise(
      () => createXcframeworkFromDylibs('hello', appleTargets),
      'Building final XCFramework with all Node-API addons...'
    );
});

export default command;
