#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ANDROID_API_LEVEL = 24;

function setupAndroidEnvironment() {
  const { ANDROID_HOME, ANDROID_NDK_HOME } = process.env;

  if (!ANDROID_HOME || !fs.existsSync(ANDROID_HOME)) {
    throw new Error('ANDROID_HOME environment variable not set or directory does not exist');
  }

  // Use ANDROID_NDK_HOME if set, otherwise try to find NDK in ANDROID_HOME
  let ndkPath;
  if (ANDROID_NDK_HOME && fs.existsSync(ANDROID_NDK_HOME)) {
    ndkPath = ANDROID_NDK_HOME;
  } else {
    // Try to find NDK in ANDROID_HOME/ndk
    const ndkDir = path.join(ANDROID_HOME, 'ndk');
    if (fs.existsSync(ndkDir)) {
      const versions = fs.readdirSync(ndkDir).filter(name => !name.startsWith('.'));
      if (versions.length === 0) {
        throw new Error('No NDK versions found in ANDROID_HOME/ndk');
      }
      // Use the first available version
      ndkPath = path.join(ndkDir, versions[0]);
    } else {
      throw new Error('NDK not found. Set ANDROID_NDK_HOME or install NDK in ANDROID_HOME/ndk');
    }
  }

  if (!fs.existsSync(ndkPath)) {
    throw new Error(`NDK path does not exist: ${ndkPath}`);
  }

  // Find the LLVM toolchain path
  const prebuiltPath = path.join(ndkPath, 'toolchains', 'llvm', 'prebuilt');
  if (!fs.existsSync(prebuiltPath)) {
    throw new Error(`LLVM toolchain not found at: ${prebuiltPath}`);
  }

  const candidates = fs.readdirSync(prebuiltPath).filter(name => !name.startsWith('.') && fs.statSync(path.join(prebuiltPath, name)).isDirectory());
  if (candidates.length === 0) {
    throw new Error('No LLVM toolchain found');
  }
  if (candidates.length > 1) {
    console.warn(`Multiple LLVM toolchains found, using: ${candidates[0]}`);
  }

  const toolchainBinPath = path.join(prebuiltPath, candidates[0], 'bin');
  if (!fs.existsSync(toolchainBinPath)) {
    throw new Error(`Toolchain bin directory not found: ${toolchainBinPath}`);
  }

  // Set up environment variables like ferric does
  const env = {
    ...process.env,

    // Android-specific linkers for each architecture
    CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER: path.join(toolchainBinPath, `aarch64-linux-android${ANDROID_API_LEVEL}-clang`),
    CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER: path.join(toolchainBinPath, `armv7a-linux-androideabi${ANDROID_API_LEVEL}-clang`),
    CARGO_TARGET_I686_LINUX_ANDROID_LINKER: path.join(toolchainBinPath, `i686-linux-android${ANDROID_API_LEVEL}-clang`),
    CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER: path.join(toolchainBinPath, `x86_64-linux-android${ANDROID_API_LEVEL}-clang`),

    // C/C++ compilers
    CC_aarch64_linux_android: path.join(toolchainBinPath, `aarch64-linux-android${ANDROID_API_LEVEL}-clang`),
    CC_armv7_linux_androideabi: path.join(toolchainBinPath, `armv7a-linux-androideabi${ANDROID_API_LEVEL}-clang`),
    CC_i686_linux_android: path.join(toolchainBinPath, `i686-linux-android${ANDROID_API_LEVEL}-clang`),
    CC_x86_64_linux_android: path.join(toolchainBinPath, `x86_64-linux-android${ANDROID_API_LEVEL}-clang`),

    CXX_aarch64_linux_android: path.join(toolchainBinPath, `aarch64-linux-android${ANDROID_API_LEVEL}-clang++`),
    CXX_armv7_linux_androideabi: path.join(toolchainBinPath, `armv7a-linux-androideabi${ANDROID_API_LEVEL}-clang++`),
    CXX_i686_linux_android: path.join(toolchainBinPath, `i686-linux-android${ANDROID_API_LEVEL}-clang++`),
    CXX_x86_64_linux_android: path.join(toolchainBinPath, `x86_64-linux-android${ANDROID_API_LEVEL}-clang++`),

    // Archive tools
    AR_aarch64_linux_android: path.join(toolchainBinPath, 'llvm-ar'),
    AR_armv7_linux_androideabi: path.join(toolchainBinPath, 'llvm-ar'),
    AR_i686_linux_android: path.join(toolchainBinPath, 'llvm-ar'),
    AR_x86_64_linux_android: path.join(toolchainBinPath, 'llvm-ar'),

    RANLIB_aarch64_linux_android: path.join(toolchainBinPath, 'llvm-ranlib'),
    RANLIB_armv7_linux_androideabi: path.join(toolchainBinPath, 'llvm-ranlib'),
    RANLIB_i686_linux_android: path.join(toolchainBinPath, 'llvm-ranlib'),
    RANLIB_x86_64_linux_android: path.join(toolchainBinPath, 'llvm-ranlib'),

    // NDK path
    ANDROID_NDK: ndkPath,

    // Add toolchain to PATH
    PATH: `${toolchainBinPath}:${process.env.PATH}`,
  };

  // Verify critical tools exist
  const criticalTools = [
    `aarch64-linux-android${ANDROID_API_LEVEL}-clang`,
    `armv7a-linux-androideabi${ANDROID_API_LEVEL}-clang`,
    `i686-linux-android${ANDROID_API_LEVEL}-clang`,
    `x86_64-linux-android${ANDROID_API_LEVEL}-clang`,
    'llvm-ar',
    'llvm-ranlib',
  ];

  for (const tool of criticalTools) {
    const toolPath = path.join(toolchainBinPath, tool);
    if (!fs.existsSync(toolPath)) {
      throw new Error(`Required tool not found: ${toolPath}`);
    }
  }

  console.log(`✅ Android NDK environment configured`);
  console.log(`   NDK Path: ${ndkPath}`);
  console.log(`   Toolchain: ${toolchainBinPath}`);
  console.log(`   API Level: ${ANDROID_API_LEVEL}`);

  return env;
}

module.exports = { setupAndroidEnvironment };

// If called directly, print the environment variables
if (require.main === module) {
  try {
    const env = setupAndroidEnvironment();

    // Print environment variables in a format that can be sourced
    console.log('\n# Environment variables for Android builds:');
    Object.entries(env).forEach(([key, value]) => {
      if (key.startsWith('CARGO_TARGET_') || key.startsWith('CC_') || key.startsWith('CXX_') ||
          key.startsWith('AR_') || key.startsWith('RANLIB_') || key === 'ANDROID_NDK') {
        console.log(`export ${key}="${value}"`);
      }
    });
    console.log(`export PATH="${env.PATH}"`);
  } catch (error) {
    console.error('❌ Error setting up Android environment:', error.message);
    process.exit(1);
  }
}