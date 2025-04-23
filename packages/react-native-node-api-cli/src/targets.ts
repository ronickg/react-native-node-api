import { type PackageJson } from './types.js';
import { type TargetDescriptionApple } from './targets.apple.js';

export type TargetCPU =
  | 'x64'
  | 'x32'
  | 'arm64'
  | 'arm'
  | 'ia32'
  | 'mips'
  | 'mips64'
  | 'ppc'
  | 'ppc64';

export type TargetOS =
  | 'darwin'
  | 'linux'
  | 'win32'
  | 'freebsd'
  | 'openbsd'
  | 'sunos';

export type TargetOSExtra =
  | 'android'
  | 'ios'
  | 'tvos'
  | 'visionos';

export interface TargetDescription {
  cpu: TargetCPU[];
  os: (TargetOS | TargetOSExtra)[];
  variant?: string;
  apple?: TargetDescriptionApple;
}

export const DEFAULT_TARGET_TRIPLES = [
  'x86_64-apple-darwin',
  'x86_64-unknown-linux-gnu',
  'x86_64-pc-windows-msvc',
];

export const SUPPORTED_TARGETS: {[triple: string]: TargetDescription} = {
  // Apple
  "aarch64-apple-darwin": {
    cpu: ['arm64'],
    os: ['darwin'],
    apple: { sdk: 'macosx', target: 'arm64-apple-darwin' },
  },
  // "x86_64-apple-darwin": { // # FIXME: Both 'macos-arm64' and 'macos-x86_64' represent tow equivalent library definitions.
  //   cpu: ['x64'],
  //   os: ['darwin'],
  //   apple: { sdk: 'macosx', target: 'x86_64-apple-darwin' },
  // },
  "aarch64-apple-ios": {
    cpu: ['arm64'],
    os: ['ios'],
    apple: { sdk: 'iphoneos', target: 'arm64-apple-ios' },
  },
  "aarch64-apple-ios-sim": {
    cpu: ['arm64'],
    os: ['ios'],
    variant: 'sim',
    apple: { sdk: 'iphonesimulator', target: 'arm64-apple-ios-simulator' },
  },
  // "x86_64-apple-ios": {
  //   cpu: ['x64'],
  //   os: ['ios'],
  //   apple: { sdk: 'iphoneos' },
  // },
  // "x86_64-apple-ios-sim": { # FIXME: Both '' and '' represent tow equivalent library definitions.
  //   cpu: ['x64'],
  //   os: ['ios'],
  //   variant: 'sim',
  //   apple: { sdk: 'iphonesimulator', target: 'x86_64-apple-ios-simulator' },
  // },
  // "armv7s-apple-ios": {
  //   cpu: ['arm'],
  //   os: ['ios'],
  //   apple: { sdk: 'iphoneos' },
  // },
  // "i386-apple-ios": {
  //   cpu: ['x32'],
  //   os: ['ios'],
  //   apple: { sdk: 'iphoneos' },
  // },
  "aarch64-apple-tvos": {
    cpu: ['arm64'],
    os: ['tvos'],
    apple: { sdk: 'appletvos' },
  },
  "aarch64-apple-tvos-sim": {
    cpu: ['arm64'],
    os: ['tvos'],
    variant: 'sim',
    apple: { sdk: 'appletvsimulator' },
  },
  "x86_64-apple-tvos": {
    cpu: ['x64'],
    os: ['tvos'],
    apple: { sdk: 'appletvos' },
  },
  "aarch64-apple-visionos": {
    cpu: ['arm64'],
    os: ['visionos'],
    apple: { sdk: 'xros' },
  },
  "aarch64-apple-visionos-sim": {
    cpu: ['arm64'],
    os: ['visionos'],
    variant: 'sim',
    apple: { sdk: 'xrsimulator' },
  },
};

/**
 * Attempts to guess the supported target platforms based on the provided package.json file.
 * This method identifies platforms by examining dependencies, peer dependencies, and engine definitions from the package.json content.
 *
 * @param {PackageJson} pkg The package.json data used to derive the target platforms.
 * @return {(keyof typeof SUPPORTED_TARGETS)[]} An array of guessed target platform keys corresponding to supported platforms.
 */
export function guessTargetsFromPackageJson(pkg: PackageJson): (keyof typeof SUPPORTED_TARGETS)[]
{
  let guessedOs: (TargetOS | TargetOSExtra)[] = [];

  {
    // Start by checking dependencies
    const dependencyNames = Object.keys({
      ...(pkg.peerDependencies || {}),
      ...(pkg.dependencies || {}),
    });

    if (dependencyNames.includes('react-native-tvos')) {
      guessedOs.push('android', 'ios', 'tvos');
    } else if (dependencyNames.includes('react-native')) {
      guessedOs.push('android', 'ios');
    }
    if (dependencyNames.includes('react-native-windows')) {
      guessedOs.push('win32');
    }
    if (dependencyNames.includes('react-native-visionos')) {
      guessedOs.push('visionos');
    }
  }

  {
    // Check if 'node' is in `engines`
    const engineNames = Object.keys(pkg?.engines || {});
    if (engineNames.includes('node')) {
      guessedOs.push('win32', 'darwin', 'linux');
    }
  }

  // Remove duplicated OS guesses and collect targets for them
  return [...new Set(guessedOs)].flatMap(os =>
    Object.entries(SUPPORTED_TARGETS)
      .filter(([_, desc]) => desc.os.find(v => v.startsWith(os)))
      .map(([triple, _]) => triple)
  );
}
