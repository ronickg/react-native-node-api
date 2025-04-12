import { Command } from "commander";
import initModuleCommand from "./commands/init.js";

const program = new Command()
  .name("react-native-node-api-cli")
  .description("Generates React Native Modules from Node-API addons")
  .configureHelp({ showGlobalOptions: true })
  .option("-v, --verbose", "Verbose output");

program.addCommand(initModuleCommand);

(async function run() {
  await program.parseAsync();
})();
