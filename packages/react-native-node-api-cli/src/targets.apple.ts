export type AppleSDK =
  | 'iphoneos'
  | 'iphonesimulator'
  | 'catalyst'
  | 'xros'
  | 'xrsimulator'
  | 'appletvos'
  | 'appletvsimulator'
  | 'macosx';

export interface TargetDescriptionApple {
  sdk: AppleSDK;
  target: string;
}
