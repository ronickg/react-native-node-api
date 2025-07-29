#!/usr/bin/env node

const { execSync } = require('child_process');
const { setupAndroidEnvironment } = require('./setup-android-env');

const ALL_ANDROID_TARGETS = [
  'aarch64-linux-android',
  'armv7-linux-androideabi',
  'i686-linux-android',
  'x86_64-linux-android'
];

function buildAndroidTarget(target, env) {
  console.log(`\n🔨 Building ${target}...`);

  try {
    execSync(`cargo build --release --target ${target}`, {
      stdio: 'inherit',
      env: env,
      cwd: process.cwd()
    });
    console.log(`✅ ${target} build completed`);
    return true;
  } catch (error) {
    console.error(`❌ ${target} build failed:`, error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);

  // If a specific target is provided, build only that target
  const targets = args.length > 0 ? args.filter(arg => ALL_ANDROID_TARGETS.includes(arg)) : ALL_ANDROID_TARGETS;

  if (targets.length === 0) {
    console.error('❌ No valid Android targets specified');
    console.error('Valid targets:', ALL_ANDROID_TARGETS.join(', '));
    process.exit(1);
  }

  try {
    console.log('🛠️  Setting up Android NDK environment...');
    const env = setupAndroidEnvironment();

    let successCount = 0;
    let totalCount = targets.length;

    console.log(`\n📱 Building ${totalCount} Android target(s): ${targets.join(', ')}`);

    for (const target of targets) {
      if (buildAndroidTarget(target, env)) {
        successCount++;
      }
    }

    console.log(`\n📊 Build Summary:`);
    console.log(`   ✅ Successful: ${successCount}/${totalCount}`);
    console.log(`   ❌ Failed: ${totalCount - successCount}/${totalCount}`);

    if (successCount === totalCount) {
      console.log('\n🎉 All Android builds completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some builds failed. Check the output above for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Failed to set up Android environment:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure ANDROID_HOME is set and points to your Android SDK');
    console.error('2. Make sure Android NDK is installed (ANDROID_NDK_HOME or ANDROID_HOME/ndk)');
    console.error('3. Make sure the required Rust targets are installed:');
    ALL_ANDROID_TARGETS.forEach(target => {
      console.error(`   rustup target add ${target}`);
    });
    process.exit(1);
  }
}

main();