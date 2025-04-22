import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

import { Command } from "@commander-js/extra-typings";

const XCFRAMEWORK_NAME = "node-api.xcframework";

/**
 * Search upwards from a directory to find a package.json and
 * return a list of the resolved paths of all dependencies of that package.
 */
export function findPackageDependencyPaths(from: string): string[] {
  const candidatePath = path.join(from, "package.json");
  const parentDir = path.dirname(from);
  if (fs.existsSync(candidatePath)) {
    const require = createRequire(from);
    const contents = fs.readFileSync(candidatePath, "utf-8");
    const json = JSON.parse(contents) as unknown;
    // Assert the package.json has the expected structure
    assert(
      typeof json === "object" && json !== null,
      "Expected package.json to be an object"
    );
    if (
      "dependencies" in json &&
      typeof json.dependencies === "object" &&
      json.dependencies !== null
    ) {
      return Object.keys(json.dependencies)
        .map((dependencyName) => {
          try {
            return path.dirname(
              require.resolve(`${dependencyName}/package.json`)
            );
          } catch {
            return undefined;
          }
        })
        .filter((p) => typeof p === "string");
    } else {
      return [];
    }
  } else if (parentDir === from) {
    throw new Error("package.json not found in any parent directory");
  } else {
    return findPackageDependencyPaths(parentDir);
  }
}

export function findXCFrameworkPaths(dependencyPath: string): string[] {
  return fs
    .readdirSync(dependencyPath, { withFileTypes: true })
    .flatMap((file) => {
      if (file.isDirectory()) {
        if (file.name === XCFRAMEWORK_NAME) {
          return [path.join(dependencyPath, file.name)];
        } else {
          // Traverse into the child directory
          return findXCFrameworkPaths(path.join(dependencyPath, file.name));
        }
      } else {
        return [];
      }
    });
}

export const program = new Command("react-native-node-api-modules");

program
  .command("print-xcframework-paths")
  .argument("<installation-root>", "Parent directory of the Podfile", (p) =>
    path.resolve(process.cwd(), p)
  )
  .action((installationRoot: string) => {
    // Find the package.json of the app
    const dependencyPaths = findPackageDependencyPaths(installationRoot);
    const xcframeworkPaths = dependencyPaths.flatMap(findXCFrameworkPaths);
    // Find all node-api.xcframeworks files in the dependencies
    console.log(JSON.stringify(xcframeworkPaths, null, 2));
  });

export function run(argv: string[]) {
  program.parse(argv);
}
