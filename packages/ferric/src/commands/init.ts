import path from "node:path";
import fs from "node:fs";

import { Command, Option } from "@commander-js/extra-typings";
import { input } from "@inquirer/prompts";
import { readPackageSync } from "read-pkg";

import { wrapAction } from "../utils.js";
import { assertFixable } from "../errors.js";

const PACKAGE_ROOT = path.join(import.meta.dirname, "..", "..");
const TEMPLATE_DIR = path.join(PACKAGE_ROOT, "template");

const { version: ferricVersion } = readPackageSync({ cwd: PACKAGE_ROOT });

const nameOption = new Option("--name <name>", "Name of the package");

async function copyTemplateFile(
  outputPath: string,
  fileName: string,
  substitutions: Record<string, string> = {}
) {
  const contents = await fs.promises.readFile(
    path.join(TEMPLATE_DIR, fileName),
    "utf-8"
  );
  const substitutedContents = Object.entries(substitutions).reduce(
    (result, [key, value]) => result.replaceAll(`<${key}>`, value),
    contents
  );
  await fs.promises.writeFile(
    path.join(outputPath, fileName),
    substitutedContents,
    "utf-8"
  );
}

async function copyTemplateDirectory(
  outputPath: string,
  fileNames: string[],
  substitutions: Record<string, string> = {}
) {
  assertFixable(
    !fs.existsSync(outputPath),
    "Expected an non-existing directory",
    {
      instructions: "Delete the directory or call with a different path",
    }
  );
  await fs.promises.mkdir(outputPath, { recursive: true });
  for (const filename of fileNames) {
    await copyTemplateFile(outputPath, filename, substitutions);
  }
}

export const initCommand = new Command("init")
  .description("Initialize a Rust Node-API module")
  .argument("[directory]", "Directory used to create the package")
  .addOption(nameOption)
  .action(
    wrapAction(async (directoryArg, { name: nameArg }) => {
      const name =
        nameArg ||
        (await input({
          message: "Package name:",
          default: directoryArg ? path.basename(directoryArg) : undefined,
        }));
      const outputPath = path.resolve(directoryArg || name);
      console.log(`Creating package "${name}" in ${outputPath}`);
      await copyTemplateDirectory(
        outputPath,
        ["package.json", "Cargo.toml", "build.rs"],
        {
          packageName: name,
          ferricVersion,
          napiCrateVersion: "2.12.2", // TODO: Fetch this from crates.io
          napiDeriveCrateVersion: "2.12.2", // TODO: Fetch this from crates.io
          napiBuildCrateVersion: "2.0.1", // TODO: Fetch this from crates.io
        }
      );
    })
  );
