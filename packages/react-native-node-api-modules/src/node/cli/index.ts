import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import cp from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";

import { Command } from "@commander-js/extra-typings";

import { hashNodeApiModulePath } from "../path-utils.js";

// Must be in all xcframeworks to be considered as Node-API modules
const MAGIC_FILENAME = "react-native-node-api-module";
// const XCFRAMEWORKS_PATH = path.resolve(__dirname, "../../../xcframeworks");
const XCFRAMEWORK_PATH = path.resolve(
  __dirname,
  "../../../node-api-modules.xcframework"
);

console.log(XCFRAMEWORK_PATH);

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

// export function findXCFrameworkPaths(dependencyPath: string): string[] {
//   return fs
//     .readdirSync(dependencyPath, { withFileTypes: true })
//     .flatMap((file) => {
//       if (
//         file.isFile() &&
//         file.name === MAGIC_FILENAME &&
//         path.extname(dependencyPath) === ".xcframework"
//       ) {
//         return [dependencyPath];
//       } else if (file.isDirectory()) {
//         // Traverse into the child directory
//         return findXCFrameworkPaths(path.join(dependencyPath, file.name));
//       }
//       return [];
//     });
// }

export function findFrameworkPaths(currentPath: string): string[] {
  return fs
    .readdirSync(currentPath, { withFileTypes: true })
    .flatMap((file) => {
      if (file.isDirectory()) {
        if (path.extname(file.name) === ".xcframework") {
          const magicFilePath = path.join(
            currentPath,
            file.name,
            MAGIC_FILENAME
          );
          if (fs.existsSync(magicFilePath)) {
            // We've found an xcframework intended for Node-API linking
            return fs
              .readdirSync(path.join(currentPath, file.name), {
                withFileTypes: true,
                recursive: true,
              })
              .filter(
                (entry) =>
                  entry.isDirectory() &&
                  path.extname(entry.name) === ".framework"
              )
              .flatMap((entry) => path.join(entry.parentPath, entry.name));
          }
        } else {
          // Traverse into the child directory
          return findFrameworkPaths(path.join(currentPath, file.name));
        }
      }
      return [];
    });
}

type UpdateInfoPlistOptions = {
  filePath: string;
  oldLibraryName: string;
  newLibraryName: string;
};

export function updateInfoPlist({
  filePath,
  oldLibraryName,
  newLibraryName,
}: UpdateInfoPlistOptions) {
  // TODO: Use a proper plist parser
  const infoPlistContents = fs.readFileSync(filePath, "utf-8");
  const updatedContents = infoPlistContents.replaceAll(
    oldLibraryName,
    newLibraryName
  );
  fs.writeFileSync(filePath, updatedContents, "utf-8");
}

export const program = new Command("react-native-node-api-modules");

program
  .command("link-xcframework-paths")
  .argument("<installation-root>", "Parent directory of the Podfile", (p) =>
    path.resolve(process.cwd(), p)
  )
  .action((installationRoot: string) => {
    const tempPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "react-native-node-api-frameworks-")
    );
    const pathsToCleanup = [tempPath];
    try {
      // Find the location of each dependency
      const dependencyPathsByName =
        findPackageDependencyPaths(installationRoot);
      // Find all their xcframeworks
      const frameworkPaths = Object.entries(dependencyPathsByName).flatMap(
        ([, dependencyPath]) => findFrameworkPaths(dependencyPath)
      );

      // To be able to reference the xcframeworks from the Podspec,
      // we need them as sub-directories of the Podspec parent directory.

      // Create or clean the output directory
      fs.rmSync(XCFRAMEWORK_PATH, { recursive: true, force: true });

      const renamedFrameworkPaths = frameworkPaths.map((frameworkPath) => {
        const modulePath = path.resolve(frameworkPath, "../..");
        assert(path.extname(modulePath) === ".xcframework");
        const hash = hashNodeApiModulePath(modulePath);

        const tempFrameworkPath = fs.mkdtempSync(
          path.join(os.tmpdir(), `react-native-node-api-framework-${hash}-`)
        );
        pathsToCleanup.push(tempFrameworkPath);

        // Copy the framework and library (renaming the framework in the process)
        const oldLibraryName = path.basename(frameworkPath, ".framework");
        // Expecting the binary to have the same name as the framework
        assert(
          fs.existsSync(path.join(frameworkPath, oldLibraryName)),
          `Expected a library binary named '${oldLibraryName}' in the framework '${frameworkPath}'`
        );
        const newLibraryName = `node-api-${hash}`;
        const newFrameworkPath = path.join(
          tempFrameworkPath,
          `${newLibraryName}.framework`
        );
        const newLibraryPath = path.join(newFrameworkPath, newLibraryName);
        fs.cpSync(frameworkPath, newFrameworkPath, { recursive: true });
        // Rename the library file
        fs.renameSync(
          path.join(newFrameworkPath, oldLibraryName),
          newLibraryPath
        );
        // Update the binary
        cp.spawnSync("install_name_tool", [
          "-id",
          `@rpath/${newLibraryName}.framework/${newLibraryName}`,
          newLibraryPath,
        ]);
        // Update the Info.plist file for the framework
        updateInfoPlist({
          filePath: path.join(newFrameworkPath, "Info.plist"),
          oldLibraryName,
          newLibraryName,
        });

        return newFrameworkPath;
      });

      // Combine all frameworks into a single xcframework
      const { status } = cp.spawnSync(
        "xcodebuild",
        [
          "-create-xcframework",
          ...renamedFrameworkPaths.flatMap((frameworkPath) => [
            "-framework",
            frameworkPath,
          ]),
          "-output",
          XCFRAMEWORK_PATH,
        ],
        {
          stdio: "inherit",
        }
      );
      assert.equal(status, 0, "Failed building xcframework");
      console.log("Wrote xcframework to", XCFRAMEWORK_PATH);
    } finally {
      for (const pathToCleanup of pathsToCleanup) {
        fs.rmSync(pathToCleanup, { recursive: true, force: true });
      }
    }
  });

export function run(argv: string[]) {
  program.parse(argv);
}
