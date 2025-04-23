import { Command } from 'commander';
import hostInitCmd from './host/commands/init.js';
import hostAutolinkCmd from './host/commands/autolink.js';
// import hostDoctorCmd from './host/commands/doctor.js';
import hostScanCmd from './host/commands/scan.js';
import moduleInitCmd from './module/commands/init.js';
import moduleBuildCmd from './module/commands/build.js';
import moduleTargetsCmd from './module/commands/targets.js';

import process from 'node:process';             // HACK: XXX: Temporary workaround for development
process.chdir('../../packages/example-cpp-node-api-addon'); // HACK: XXX: Temporary workaround for development

const program = new Command()
  .name('react-native-node-api-cli')
  .description('Generates React Native Modules from Node-API addons')
  .configureHelp({ showGlobalOptions: true })
  .option('-v, --verbose', 'Verbose output');

program.addCommand(hostInitCmd);
program.addCommand(hostAutolinkCmd);
// program.addCommand(hostDoctorCmd);
program.addCommand(hostScanCmd);

program.addCommand(moduleInitCmd);
program.addCommand(moduleBuildCmd);
program.addCommand(moduleTargetsCmd);

(async function run() {
  try {
    await program.parseAsync();
  } catch (e) {
    throw e;
  }
})();
