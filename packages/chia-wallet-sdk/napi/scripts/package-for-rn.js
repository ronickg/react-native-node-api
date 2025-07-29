#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LIBRARY_NAME = 'chia-wallet-sdk';
const ROOT_DIR = process.cwd();
const TARGET_DIR = path.join(ROOT_DIR, '..', 'target'); // Workspace target directory

// Output directories for React Native
const IOS_OUTPUT_DIR = path.join(ROOT_DIR, `${LIBRARY_NAME}.apple.node`);
const ANDROID_OUTPUT_DIR = path.join(ROOT_DIR, `${LIBRARY_NAME}.android.node`);

// Source libraries
const IOS_ARM64_LIB = path.join(TARGET_DIR, 'aarch64-apple-ios', 'release', 'libchia_wallet_sdk_napi.a');
const IOS_SIM_ARM64_LIB = path.join(TARGET_DIR, 'aarch64-apple-ios-sim', 'release', 'libchia_wallet_sdk_napi.a');

// Android libraries - All 4 architectures
const ANDROID_LIBS = [
  {
    target: 'aarch64-linux-android',
    dir: 'arm64-v8a',
    lib: path.join(TARGET_DIR, 'aarch64-linux-android', 'release', 'libchia_wallet_sdk_napi.so')
  },
  {
    target: 'armv7-linux-androideabi',
    dir: 'armeabi-v7a',
    lib: path.join(TARGET_DIR, 'armv7-linux-androideabi', 'release', 'libchia_wallet_sdk_napi.so')
  },
  {
    target: 'i686-linux-android',
    dir: 'x86',
    lib: path.join(TARGET_DIR, 'i686-linux-android', 'release', 'libchia_wallet_sdk_napi.so')
  },
  {
    target: 'x86_64-linux-android',
    dir: 'x86_64',
    lib: path.join(TARGET_DIR, 'x86_64-linux-android', 'release', 'libchia_wallet_sdk_napi.so')
  }
];

function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createiOSFramework() {
  console.log('📱 Creating iOS framework...');

  const frameworkDir = path.join(IOS_OUTPUT_DIR, `${LIBRARY_NAME}.framework`);
  createDirectoryIfNotExists(frameworkDir);

  // Create Info.plist
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleExecutable</key>
	<string>${LIBRARY_NAME}</string>
	<key>CFBundleIdentifier</key>
	<string>com.chia.${LIBRARY_NAME}</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>${LIBRARY_NAME}</string>
	<key>CFBundlePackageType</key>
	<string>FMWK</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>MinimumOSVersion</key>
	<string>11.0</string>
</dict>
</plist>`;

  fs.writeFileSync(path.join(frameworkDir, 'Info.plist'), infoPlist);

  // Create universal binary
  const libs = [];
  if (fs.existsSync(IOS_ARM64_LIB)) {
    libs.push(IOS_ARM64_LIB);
    console.log('  ✅ Found iOS ARM64 library');
  }
  if (fs.existsSync(IOS_SIM_ARM64_LIB)) {
    libs.push(IOS_SIM_ARM64_LIB);
    console.log('  ✅ Found iOS Simulator ARM64 library');
  }

  if (libs.length === 0) {
    console.log('  ⚠️  No iOS libraries found, skipping iOS framework');
    return false;
  }

  const outputLib = path.join(frameworkDir, LIBRARY_NAME);

  if (libs.length === 1) {
    fs.copyFileSync(libs[0], outputLib);
    console.log('  📦 Copied single library');
  } else {
    try {
      execSync(`lipo -create ${libs.join(' ')} -output ${outputLib}`, { stdio: 'inherit' });
      console.log('  🔗 Created universal binary');
    } catch (error) {
      console.log('  ⚠️  lipo failed, copying first library as fallback');
      fs.copyFileSync(libs[0], outputLib);
    }
  }

  // Create react-native-node-api-module marker
  fs.writeFileSync(path.join(IOS_OUTPUT_DIR, 'react-native-node-api-module'), '');
  console.log('  ✅ iOS framework complete');
  return true;
}

function createAndroidLibs() {
  console.log('🤖 Creating Android libraries (all 4 architectures)...');

  let copiedLibs = 0;

  // Process each Android architecture
  for (const { target, dir, lib } of ANDROID_LIBS) {
    const archDir = path.join(ANDROID_OUTPUT_DIR, dir);
    createDirectoryIfNotExists(archDir);

    if (fs.existsSync(lib)) {
      fs.copyFileSync(lib, path.join(archDir, `lib${LIBRARY_NAME}.so`));
      console.log(`  ✅ ${target} (${dir}) library copied`);
      copiedLibs++;
    } else {
      console.log(`  ⚠️  ${target} (${dir}) library not found`);
    }
  }

  if (copiedLibs === 0) {
    console.log('  ⚠️  No Android libraries found, skipping Android setup');
    return false;
  }

  // Create react-native-node-api-module marker
  fs.writeFileSync(path.join(ANDROID_OUTPUT_DIR, 'react-native-node-api-module'), '');
  console.log(`  ✅ Android libraries complete (${copiedLibs}/4 architectures)`);
  return true;
}

function createReactNativeLoader() {
  console.log('📝 Creating React Native loader...');

  // Create simple React Native compatible JavaScript loader
  const loaderContent = `/* eslint-disable */

/**
 * This file was generated for React Native compatibility
 * ╭─────────────────────────╮
 * │░█▀▀░█▀▀░█▀▄░█▀▄░▀█▀░█▀▀░│
 * │░█▀▀░█▀▀░█▀▄░█▀▄░░█░░█░░░│
 * │░▀░░░▀▀▀░▀░▀░▀░▀▀▀░▀▀▀░│
 * ╰─────────────────────────╯
 * Powered by react-native-node-api
 */

module.exports = require('./${LIBRARY_NAME}.node');
`;

  fs.writeFileSync(path.join(ROOT_DIR, `${LIBRARY_NAME}.js`), loaderContent);

  // Copy the auto-generated TypeScript definitions for React Native
  const sourceTypeDefs = path.join(ROOT_DIR, 'index.d.ts');
  const targetTypeDefs = path.join(ROOT_DIR, `${LIBRARY_NAME}.d.ts`);

  if (fs.existsSync(sourceTypeDefs)) {
    let typeContent = fs.readFileSync(sourceTypeDefs, 'utf8');

    // Replace the auto-generated comment with React Native specific comment
    typeContent = typeContent.replace(
      '/* auto-generated by NAPI-RS */',
      `/**
 * This file was generated for React Native compatibility
 * ╭─────────────────────────╮
 * │░█▀▀░█▀▀░█▀▄░█▀▄░▀█▀░█▀▀░│
 * │░█▀▀░█▀▀░█▀▄░█▀▄░░█░░█░░░│
 * │░▀░░░▀▀▀░▀░▀░▀░▀▀▀░▀▀▀░│
 * ╰─────────────────────────╯
 * Powered by react-native-node-api
 */`
    );

    fs.writeFileSync(targetTypeDefs, typeContent);
    console.log('  ✅ TypeScript definitions copied');
  } else {
    console.log('  ⚠️  TypeScript definitions not found');
  }

  console.log('  ✅ React Native loader complete');
}

function main() {
  console.log(`🚀 Packaging ${LIBRARY_NAME} for React Native\n`);

  let hasAnyPlatform = false;

  // Clean up existing directories
  if (fs.existsSync(IOS_OUTPUT_DIR)) {
    fs.rmSync(IOS_OUTPUT_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(ANDROID_OUTPUT_DIR)) {
    fs.rmSync(ANDROID_OUTPUT_DIR, { recursive: true, force: true });
  }

  // Create platform-specific packages
  if (createiOSFramework()) {
    hasAnyPlatform = true;
  }

  if (createAndroidLibs()) {
    hasAnyPlatform = true;
  }

  if (!hasAnyPlatform) {
    console.error('\n❌ No platform libraries found. Please run the build commands first:');
    console.error('   npm run build:rn:ios');
    console.error('   npm run build:rn:android');
    process.exit(1);
  }

  // Create the React Native loader
  createReactNativeLoader();

  console.log('\n🎉 React Native packaging complete!');
  console.log('\nFiles created:');
  console.log(`   📱 ${LIBRARY_NAME}.apple.node/`);
  console.log(`   🤖 ${LIBRARY_NAME}.android.node/`);
  for (const { dir } of ANDROID_LIBS) {
    console.log(`      └── ${dir}/lib${LIBRARY_NAME}.so`);
  }
  console.log(`   📝 ${LIBRARY_NAME}.js`);
  console.log(`   📘 ${LIBRARY_NAME}.d.ts`);
  console.log('\nTo use in React Native:');
  console.log(`   const ChiaWalletSDK = require('./${LIBRARY_NAME}');`);
}

main();