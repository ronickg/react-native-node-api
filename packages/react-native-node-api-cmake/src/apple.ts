import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { SupportedTriplet } from "./triplets.js";

export const APPLE_TRIPLETS = [
  "arm64;x86_64-apple-darwin",
  "x86_64-apple-darwin",
  "arm64-apple-darwin",
  "arm64-apple-ios",
  "arm64-apple-ios-sim",
  "arm64-apple-tvos",
  "arm64-apple-tvos-sim",
  // "x86_64-apple-tvos",
  "arm64-apple-visionos",
  "arm64-apple-visionos-sim",
] as const;

export type AppleTriplet = (typeof APPLE_TRIPLETS)[number];

export const DEFAULT_APPLE_TRIPLETS = [
  "arm64;x86_64-apple-darwin",
  "arm64-apple-ios",
  "arm64-apple-ios-sim",
  "arm64-apple-tvos",
  "arm64-apple-tvos-sim",
  "arm64-apple-visionos",
  "arm64-apple-visionos-sim",
] as const satisfies AppleTriplet[];

type XcodeSDKName =
  | "iphoneos"
  | "iphonesimulator"
  | "catalyst"
  | "xros"
  | "xrsimulator"
  | "appletvos"
  | "appletvsimulator"
  | "macosx";

const SDK_NAMES = {
  "x86_64-apple-darwin": "macosx",
  "arm64-apple-darwin": "macosx",
  "arm64;x86_64-apple-darwin": "macosx",
  "arm64-apple-ios": "iphoneos",
  "arm64-apple-ios-sim": "iphonesimulator",
  "arm64-apple-tvos": "appletvos",
  // "x86_64-apple-tvos": "appletvos",
  "arm64-apple-tvos-sim": "appletvsimulator",
  "arm64-apple-visionos": "xros",
  "arm64-apple-visionos-sim": "xrsimulator",
} satisfies Record<AppleTriplet, XcodeSDKName>;

type AppleArchitecture = "arm64" | "x86_64" | "arm64;x86_64";

export const ARCHITECTURES = {
  "x86_64-apple-darwin": "x86_64",
  "arm64-apple-darwin": "arm64",
  "arm64;x86_64-apple-darwin": "arm64;x86_64",
  "arm64-apple-ios": "arm64",
  "arm64-apple-ios-sim": "arm64",
  "arm64-apple-tvos": "arm64",
  // "x86_64-apple-tvos": "x86_64",
  "arm64-apple-tvos-sim": "arm64",
  "arm64-apple-visionos": "arm64",
  "arm64-apple-visionos-sim": "arm64",
} satisfies Record<AppleTriplet, AppleArchitecture>;

export function isAppleTriplet(
  triplet: SupportedTriplet
): triplet is AppleTriplet {
  return APPLE_TRIPLETS.includes(triplet as AppleTriplet);
}

export function getAppleSDKPath(triplet: AppleTriplet) {
  return cp
    .spawnSync("xcrun", ["--sdk", SDK_NAMES[triplet], "--show-sdk-path"], {
      encoding: "utf-8",
    })
    .stdout.trim();
}

export function getAppleConfigureCmakeArgs(triplet: AppleTriplet) {
  assert(isAppleTriplet(triplet));
  const sdkPath = getAppleSDKPath(triplet);

  return [
    // Use the XCode as generator for Apple platforms
    "-G",
    "Xcode",
    // Pass linker flags to avoid errors from undefined symbols
    "-D",
    `CMAKE_SHARED_LINKER_FLAGS="-Wl,-undefined,dynamic_lookup"`,
    // Set the SDK path for the target platform
    "-D",
    `CMAKE_OSX_SYSROOT=${sdkPath}`,
    // Set the target architecture
    "-D",
    `CMAKE_OSX_ARCHITECTURES=${ARCHITECTURES[triplet]}`,
  ];
}

export function getAppleBuildArgs() {
  // We expect the final application to sign these binaries
  return ["CODE_SIGNING_ALLOWED=NO"];
}

type XCframeworkOptions = {
  libraryPaths: string[];
  frameworkPaths: string[];
  outputPath: string;
};

export function createFramework(libraryPath: string) {
  assert(fs.existsSync(libraryPath), `Library not found: ${libraryPath}`);
  // Write a info.plist file to the framework
  const libraryName = path.basename(libraryPath, path.extname(libraryPath));
  const frameworkPath = path.join(
    path.dirname(libraryPath),
    `${libraryName}.framework`
  );
  // Create the framework from scratch
  fs.rmSync(frameworkPath, { recursive: true, force: true });
  fs.mkdirSync(frameworkPath);
  fs.mkdirSync(path.join(frameworkPath, "Headers"));
  const newLibraryPath = path.join(frameworkPath, libraryName);
  fs.renameSync(libraryPath, newLibraryPath);
  // Update the name of the library
  // cp.spawnSync("install_name_tool", [
  //   "-id",
  //   `@rpath/${libraryName}`,
  //   newLibraryPath,
  // ]);
  return frameworkPath;
}

export function createXCframework({
  libraryPaths,
  frameworkPaths,
  outputPath,
}: XCframeworkOptions) {
  // Delete any existing xcframework to prevent the error:
  // - A library with the identifier 'macos-arm64' already exists.
  // Ideally, it would only be necessary to delete the specific platform+arch, to allow selectively building from source.
  fs.rmSync(outputPath, { recursive: true, force: true });

  const { status } = cp.spawnSync(
    "xcodebuild",
    [
      "-create-xcframework",
      ...libraryPaths.flatMap((p) => ["-library", p]),
      ...frameworkPaths.flatMap((p) => ["-framework", p]),
      "-output",
      outputPath,
    ],
    {
      stdio: "inherit",
    }
  );
  assert.equal(status, 0, "Failed to create xcframework");
  // Write a file to mark the xcframework is a Node-API module
  fs.writeFileSync(
    path.join(outputPath, "react-native-node-api-module"),
    "",
    "utf8"
  );
}

/**
 * Determine the filename of the xcframework based on the framework paths.
 * Ensuring that all framework paths have the same base name.
 */
export function determineXCFrameworkFilename(frameworkPaths: string[]) {
  const frameworkNames = frameworkPaths.map((p) =>
    path.basename(p, path.extname(p))
  );
  const candidates = new Set<string>(frameworkNames);
  assert(
    candidates.size === 1,
    "Expected all frameworks to have the same name"
  );
  const [name] = candidates;
  return `${name}.xcframework`;
}
