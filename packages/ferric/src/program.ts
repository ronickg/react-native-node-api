import { Command } from "@commander-js/extra-typings";

import { printBanner } from "./banner.js";
import { initCommand } from "./commands/init.js";
import { buildCommand } from "./commands/build.js";

export const program = new Command("ferric")
  .hook("preAction", () => printBanner())
  .description("Rust Node-API Modules for React Native")
  .addCommand(initCommand)
  .addCommand(buildCommand);
