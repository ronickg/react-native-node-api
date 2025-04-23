import { execSync } from 'node:child_process';
import { Command, Option } from 'commander';
import { DEFAULT_TARGET_TRIPLES, SUPPORTED_TARGETS } from '../../targets.js';
import type { NapiConfig, PackageJson } from '../../types.js';
import { findProjectRoot, processJsonFile, readJson } from '../../common/project.js';

const targets = new Command('targets');

interface AddRemoveOptions {
  dryRun?: boolean;
}

const dryRunOption = new Option('-d, --dry-run', 'Print resulting `package.json` instead updating it');

targets
  .command('add')
  .description('Add target to build')
  .addOption(dryRunOption)
  .argument('<target...>')
  .action(async (args: string[], options: AddRemoveOptions) => {
    const projectRoot = await findProjectRoot();
    processJsonFile<PackageJson>(
      `${projectRoot}/package.json`,
      (pkg, commit) => {
        // TODO: Make sure that this project has `napi` object, otherwise error (suggest running `cli init-module`)
        const hasNapiConfig = Object.hasOwn(pkg, 'napi');
        if (!hasNapiConfig) {
          console.error(
            `Missing "napi" config object in "${projectRoot}/package.json"! ` +
            'Make sure you ran `cli init-module` first.'
          );
          return; // TODO: Return with error code!
        }

        // Get lists of all used targets
        const defaultTargets = [...(pkg.napi!.triples?.defaults === false ? [] : DEFAULT_TARGET_TRIPLES)];
        const extraTargets = [...(pkg.napi!.triples?.additional ?? [])];

        let hasChanged = false;
        for (const target of args) {
          // TODO: Check if given argument is a valid target triple
          if (!Object.hasOwn(SUPPORTED_TARGETS, target)) {
            console.warn('Not a supported target name:', target)
          }

          // Check if given target triple is not already added, skip if so
          if (defaultTargets.includes(target) || extraTargets.includes(target)) {
            continue; // already added
          }

          // Add given target triple
          console.log('Adding target:', target, 'options:', options);
          extraTargets.push(target);
          hasChanged ||= true;
        }

        // Update `package.json` file (if there are changes)
        if (hasChanged) {
          pkg.napi!.triples = {
            ...(pkg.napi?.triples),
            additional: extraTargets,
          };
          commit(pkg);
        }
      },
      options.dryRun ?? false
    );
  });

targets
  .command('rm')
  .description('Remove target from build')
  .addOption(dryRunOption)
  .argument('<target...>')
  .action(async (args: string[], options: AddRemoveOptions) => {
    const projectRoot = await findProjectRoot();

    processJsonFile<PackageJson>(
      `${projectRoot}/package.json`,
      (pkg, commit) => {
        // TODO: Make sure that this project has `napi` object, otherwise error (suggest running `cli init-module`)
        const hasNapiConfig = Object.hasOwn(pkg, 'napi');
        if (!hasNapiConfig) {
          console.error(
            `Missing "napi" config object in "${projectRoot}/package.json"! ` +
            'Make sure you ran `cli init-module` first.'
          );
          return; // TODO: Return with error code!
        }

        // Get lists of all used targets
        let defaultTargets = [...(pkg.napi!.triples?.defaults === false ? [] : DEFAULT_TARGET_TRIPLES)];
        let extraTargets = [...(pkg.napi!.triples?.additional ?? [])];

        let hasChanged = false;
        for (const target of args) {
          // Check if given argument is a valid target triple
          if (!Object.hasOwn(SUPPORTED_TARGETS, target)) {
            console.warn('Not a supported target name:', target)
          }

          // When removing a 'default' triple, we have to flip `defaults` to
          // `false` and move remaining defaults to `additional` list
          if (defaultTargets.includes(target)) {
            // FIXME: Make sure that we are not adding duplicate targets
            extraTargets = [
              ...(defaultTargets.filter(t => t !== target)),
              ...(extraTargets.filter(t => !defaultTargets.includes(t))),
            ];

            defaultTargets = [];
            pkg.napi!.triples.defaults = false;
          } else if (extraTargets.includes(target)) {
            extraTargets = extraTargets.filter(t => t !== target);
          } else {
            continue; // target was not present at all...
          }

          // Add given target triple
          console.log('Removed target:', target, 'options:', options);
          extraTargets.push(target);
          hasChanged ||= true;
        }

        // Update `package.json` file (if there are changes)
        if (hasChanged) {
          pkg.napi!.triples = {
            ...(pkg.napi?.triples),
            additional: extraTargets,
          };
          commit(pkg);
        }
      },
      options.dryRun ?? false
    );
  });

interface ListOptions {
  all?: boolean;
  onlySupported?: boolean;
}

targets
  .command('list')
  .description('List build targets')
  .addOption(new Option('-a, --all', 'List all available targets'))
  .addOption(new Option('-o, --only-supported', 'Show only currently buildable targets'))
  .action(async (options: ListOptions) => {
    // (nothing)  =>  List targets from package.json (including the default ones if applicable)
    // -a         =>  List all available targets (from rust and what we add on top of it; no package.json needed)
    //      -o    =>  Filter the targets from package.json (including defaults if applicable) leaving only supported on current machine
    // -a   -o    =>  Filter all targets (rust + added on top) leaving only supported on current machine

    // Collect targets (when `--all` then just return everything, otherwise from `package.json`)
    let targets: string[] = [];
    if (options.all) {
      // Start with all targets that we support directly
      // TODO: How to check what is currently available/possible?
      targets.push(...Object.keys(SUPPORTED_TARGETS));

      // And then try to get a list of targets supported by rust (only if you have it installed...)
      try {
        const rustTargets = execSync('rustup target list').toString();
        rustTargets.split('\n').filter(Boolean).forEach(line => {
          const tokens = line.split(' ');
          const isInstalled = tokens.includes('(installed)');
          if (isInstalled || !options.onlySupported) {
            targets.push(tokens[0]!);
          }
        });
      } catch {}
    } else {
      // Source targets from `napi` config object in `package.json`
      const projectRoot = await findProjectRoot();
      const pkgFile = await readJson<PackageJson>(`${projectRoot}/package.json`);

      // Check, if `package.json` has a `napi` object created by napi-rs or by us.
      // If so, just use values from there and ask for missing ones.
      const config: Partial<NapiConfig> = { ...(pkgFile.data.napi) };

      const usesDefaults = config.triples?.defaults ?? true;
      const extraTargets = config.triples?.additional ?? [];

      if (usesDefaults) {
        targets.push(...DEFAULT_TARGET_TRIPLES);
      }
      targets.push(...extraTargets);
    }

    // TODO: If `--only-supported` is used, then filter this list by everything that can be built locally (found SDKs?)

    // Print all the targets (one per line)
    targets.forEach(t => console.log(t));
  });

export default targets;
