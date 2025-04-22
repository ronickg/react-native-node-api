import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

import { Command } from "@commander-js/extra-typings";

// Must be in all xcframeworks to be considered as Node-API modules
const MAGIC_FILENAME = "react-native-node-api-module";

/**
 * Search upwards from a directory to find a package.json and
 * return a list of the resolved paths of all dependencies of that package.
 */
export function findPackageDependencyPaths(
  from: string
): Record<string, string> {
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
      return Object.fromEntries(
        Object.keys(json.dependencies)
          .map((dependencyName) => {
            try {
              return [
                dependencyName,
                path.dirname(require.resolve(`${dependencyName}/package.json`)),
              ];
            } catch {
              return undefined;
            }
          })
          .filter((item) => typeof item !== "undefined")
      );
    } else {
      return {};
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
      if (
        file.isFile() &&
        file.name === MAGIC_FILENAME &&
        path.extname(dependencyPath) === ".xcframework"
      ) {
        return [dependencyPath];
      } else if (file.isDirectory()) {
        // Traverse into the child directory
        return findXCFrameworkPaths(path.join(dependencyPath, file.name));
      }
      return [];
    });
}

export const program = new Command("react-native-node-api-modules");

program
  .command("link-xcframework-paths")
  .argument("<installation-root>", "Parent directory of the Podfile", (p) =>
    path.resolve(process.cwd(), p)
  )
  .action((installationRoot: string) => {
    // Find the location of each dependency
    const dependencyPathsByName = findPackageDependencyPaths(installationRoot);
    // Find all their xcframeworks
    const dependenciesByName = Object.fromEntries(
      Object.entries(dependencyPathsByName)
        .map(([dependencyName, dependencyPath]) => {
          // Make all the xcframeworks relative to the dependency path
          const xcframeworkPaths = findXCFrameworkPaths(dependencyPath).map(
            (p) => path.relative(dependencyPath, p)
          );
          return [
            dependencyName,
            {
              path: dependencyPath,
              xcframeworkPaths,
            },
          ] as const;
        })
        // Remove any dependencies without xcframeworks
        .filter(([, { xcframeworkPaths }]) => xcframeworkPaths.length > 0)
    );
    // To be able to reference the xcframeworks from the Podspec,
    // we need them as sub-directories of the Podspec parent directory.
    const outputPath = path.resolve(
      __dirname,
      "..",
      "..",
      "vendored-xcframeworks"
    );
    // Create or clean the output directory
    fs.rmSync(outputPath, { recursive: true, force: true });
    fs.mkdirSync(outputPath, { recursive: true });
    // Create symbolic links for each xcframework found in dependencies
    const linkedXcframeworkPaths = Object.entries(dependenciesByName).flatMap(
      ([name, dependency]) => {
        return dependency.xcframeworkPaths.map((xcframeworkPath) => {
          const fromPath = path.join(dependency.path, xcframeworkPath);
          const linkedPath = path.join(outputPath, name, xcframeworkPath);
          fs.mkdirSync(path.dirname(linkedPath), { recursive: true });
          fs.symlinkSync(fromPath, linkedPath, "dir");
          return linkedPath;
        });
      }
    );
    console.log(JSON.stringify(linkedXcframeworkPaths, null, 2));
  });

export function run(argv: string[]) {
  program.parse(argv);
}
