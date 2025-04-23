import fs from 'node:fs/promises';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {execa} from '../../common/utils.js';
import {inferTargetTripletFromAddonPath} from '../../host/utils.js'; // FIXME: This dependency seems wrong
import {serializePlist} from "./plist.js";

interface FrameworkOptions {
  bundleId: string;
  bundleVersion: string;
  targetName?: string;
  outputDir?: string;
}

/**
 * Creates an iOS-compatible framework from a provided dynamic library (.dylib).
 * NOTE: To pass App Store review, iOS apps must have dylibs put inside frameworks.
 *
 * @param {string} dylibPath - The file path to the dynamic library (.dylib) to be wrapped into a framework.
 * @param {FrameworkOptions} options - Additional options configuring the generated framework, e.g., custom name.
 * @return {Promise<string>} The file path to the created framework directory.
 * @throws {Error} If the target platform cannot be inferred from the dylib path or if the platform is unsupported.
 */
async function createFrameworkFromDylib(dylibPath: string, options: FrameworkOptions) {
  const targetName = options.targetName ?? path.basename(dylibPath, '.node');
  const target = inferTargetTripletFromAddonPath(dylibPath);
  if (target === undefined) {
    throw new Error('Failed to infer target from path');
  }
  const [platform, _arch, variant] = target!;

  let supportedPlatform = 'iPhoneOS';
  if (platform === 'ios') {
    if (variant === 'sim' || variant === 'simulator') {
      supportedPlatform = 'iPhoneSimulator';
    } else {
      supportedPlatform = 'iPhoneOS';
    }
  } else {
    throw new Error(`Not implemented: Unsupported platform "${platform}" for creating framework from dylib`);
  }

  const hostBuildVersion = execSync('sw_vers --buildVersion').toString().trim();
  const plistSource = serializePlist({
    'BuildMachineOSBuild': hostBuildVersion,
    'CFBundleDevelopmentRegion': 'en',
    'CFBundleExecutable': targetName,
    'CFBundleIdentifier': options.bundleId,
    'CFBundleInfoDictionaryVersion': '6.0',
    'CFBundleName': targetName,
    'CFBundlePackageType': 'FMWK',
    'CFBundleShortVersionString': options.bundleVersion,
    'CFBundleSupportedPlatforms': [supportedPlatform],
    'CFBundleVersion': 1,
    'MinimumOSVersion': '16.0',
    'UIDeviceFamily': [1, 2],
  });

  const outputDir = options.outputDir ?? `${path.dirname(dylibPath)}/Frameworks`;
  const frameworkDir = `${outputDir}/${targetName}.framework`;
  await fs.mkdir(frameworkDir, { recursive: true });
  execSync(`lipo -create "${dylibPath}" -output "${frameworkDir}/${targetName}"`);
  await fs.writeFile(`${frameworkDir}/Info.plist`, plistSource);
  return frameworkDir;
}

/**
 * Creates an XCFramework from the specified frameworks.
 *
 * This function generates an `.xcframework` bundle combining multiple provided
 * framework paths, which is required for multi-platform compatibility in Apple
 * ecosystem development.
 *
 * @param {string} packageName - The name of the package for which the XCFramework is being built.
 * @param {string[]} frameworkPaths - Array of paths to the individual frameworks to be bundled into the XCFramework.
 * @return {Promise<void>} A promise that resolves when the XCFramework has been successfully built.
 */
async function createXcframeworkFromFrameworks(packageName: string, frameworkPaths: string[]): Promise<void> {
  const outputDir = `Frameworks/${packageName}.xcframework`;
  try {
    // HACK: `-create-xcframework` fails when libraries already exist, so we remove them...
    // TODO: Instead of removing whole xcframework we should only remove what we are adding?
    if ((await fs.lstat(outputDir)).isDirectory()) {
      await fs.rm(outputDir, { recursive: true });
    }
  } catch {}

  // Build the XCFramework from the '.dylib' files
  await execa('xcodebuild', [
    '-create-xcframework',
    ...frameworkPaths.flatMap(fw => ['-framework', fw]),
    '-output', outputDir,
  ]);
}

/**
 * Creates an XCFramework from the provided dylibs by first creating frameworks from each dylib
 * and then combining those frameworks into a single XCFramework.
 *
 * @param {string} packageName - The name of the XCFramework package to be created.
 * @param {string[]} appleAddonPaths - Array of file paths to the dylibs used to create the frameworks.
 * @return {Promise<string>} A promise that resolves to the file path of the created XCFramework.
 */
export async function createXcframeworkFromDylibs(packageName: string, appleAddonPaths: string[]) {
  const options: FrameworkOptions = {
    bundleId: 'some.bundle.id',
    bundleVersion: '1.0.0',
  };
  const frameworks = await Promise.all(
    appleAddonPaths.map(addonPath => createFrameworkFromDylib(addonPath, options))
  );

  // Now create a "fat" xcframework from each framework
  return createXcframeworkFromFrameworks(packageName, frameworks);
}
