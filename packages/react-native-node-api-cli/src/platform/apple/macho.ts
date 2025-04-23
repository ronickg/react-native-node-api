import { execa } from '../../common/utils.js';

const enum MachoPlatform {
  MACOS = '1',
  IOS = '2',
  TVOS = '3',
  WATCHOS = '4',
  MAC_CATALYST = '6',
  IOS_SIMULATOR = '7',
  TVOS_SIMULATOR = '8',
  WATCHOS_SIMULATOR = '9',
  VISIONOS = '11',
  VISIONOS_SIMULATOR = '12',
}

export type AppleSDK =
  | 'iphoneos'
  | 'iphonesimulator'
  | 'catalyst'
  | 'xros'
  | 'xrsimulator'
  | 'appletvos'
  | 'appletvsimulator'
  | 'macosx';

interface ApplePlatformDesc {
  machoId: MachoPlatform;
  name: string;
  os: string;
  sdk: AppleSDK;
}

const supportedPlatformsTable: ApplePlatformDesc[] = [
  { machoId: MachoPlatform.MACOS, name: 'macOS', os: 'macos', sdk: 'macosx', }, // TODO: What's the "platform=" name here?
  { machoId: MachoPlatform.IOS, name: 'iOS', os: 'ios', sdk: 'iphoneos', },
  { machoId: MachoPlatform.TVOS, name: 'tvOS', os: 'tvos', sdk: 'appletvos', },
  { machoId: MachoPlatform.WATCHOS, name: 'watchOS', os: 'watchos', sdk: undefined, }, // TODO: What's the SDK?
  { machoId: MachoPlatform.MAC_CATALYST, name: 'Mac Catalyst', sdk: 'catalyst', }, // "platform=macOS,arch=x86_64,variant=Mac Catalyst"
  { machoId: MachoPlatform.IOS_SIMULATOR, name: 'iOS Simulator', os: 'ios', sdk: 'iphonesimulator', },
  { machoId: MachoPlatform.TVOS_SIMULATOR, name: 'tvOS Simulator', os: 'tvos', sdk: 'appletvsimulator', },
  { machoId: MachoPlatform.WATCHOS_SIMULATOR, name: 'watchOS Simulator', os: 'watchos', sdk: undefined }, // TODO: What's the SDK?
  { machoId: MachoPlatform.VISIONOS, name: 'visionOS', os: 'visionos', sdk: 'xros' },
  { machoId: MachoPlatform.VISIONOS_SIMULATOR, name: 'visionOS Simulator', os: 'visionos', sdk: 'xrsimulator', },
];

interface MachoVersion {
  major: number;
  minor: number;
  patch: number;
}

interface MachoBuildVersion {
  platform: MachoPlatform;
  minOs: MachoVersion;
  sdk: MachoVersion;
  ntools: number;
  tool: number;
  version: MachoVersion;
}

function handleBuildVersionCmd(name: string, body: string) {
  const platform = undefined; // TODO: Implement me
}

type MachoLoadCommand = 'LC_BUILD_VERSION';

const loadCmdToHandler: {[name: MachoLoadCommand]: (name: string, body: string) => object} = {
  'LC_BUILD_VERSION': handleBuildVersionCmd,
};

export function handleLoadCmd(name: string, body: string) {
  const cmdName = body.match(/cmd (\w+)\n/)![1];
  switch (cmdName) {
    case 'LC_BUILD_VERSION':
      return handleBuildVersionCmd(body);

    default:
      return {
        _rawBody: body,
        sectname,
      };
  }
}

async function getUndefinedSymbols(path: string) {
  const output = await execa('nm', ['-u', path]);
  return output.split('\n').map(s => s.trim());
}
