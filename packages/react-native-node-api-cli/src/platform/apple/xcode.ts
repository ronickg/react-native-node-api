import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const execAsync = promisify(exec);

interface XcodeSdkInfo {
  buildID?: string; // driverkit doesn't have it
  canonicalName: string;
  displayName: string;
  isBaseSdk: boolean;
  platform: string;
  platformPath: string;
  platformVersion: string;
  productBuildVersion?: string; // driverkit doesn't have it
  productCopyright?: string; // driverkit doesn't have it
  productName?: string; // driverkit doesn't have it
  productVersion?: string; // driverkit doesn't have it
  sdkPath: string;
  sdkVersion: string;
}

export async function getXcodeSdks() {
  const { stdout } = await execAsync('xcodebuild -showsdks -json');
  return JSON.parse(stdout) as XcodeSdkInfo[];
}

function getStemNaive(fileName: string) {
  const dotPos = fileName.indexOf('.');
  return fileName.substring(0, dotPos);
}

export async function getXcodeTargetsForSdk(sdkPath: string) {
  const fwDir = `${sdkPath}/System/Library/Frameworks/Foundation.framework/Modules/Foundation.swiftmodule`;
  try {
    const files = await readdir(fwDir);
    const targets = new Set(files.map(getStemNaive));
    return Array.from(targets);
  } catch {
    return [];
  }
}

// NOTE: *-apple-ios-macabi are Apple Mac Catalyst targets
export async function getXcodeTargetsMap() {
  const sdks = await getXcodeSdks();
  return Object.fromEntries(
    await Promise.all(
      sdks.map(async sdk => {
        const targets = await getXcodeTargetsForSdk(sdk.sdkPath);
        return [sdk.platform, targets];
      })
    )
  );
}
