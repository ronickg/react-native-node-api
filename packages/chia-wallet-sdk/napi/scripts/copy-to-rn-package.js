#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const LIBRARY_NAME = "chia-wallet-sdk";
const SOURCE_DIR = process.cwd(); // packages/chia-wallet-sdk/napi
const PACKAGES_DIR = path.join(SOURCE_DIR, "..", ".."); // packages/
const TARGET_DIR = path.join(PACKAGES_DIR, "rn-chia-wallet-sdk");

// Files to copy
const FILES_TO_COPY = [`${LIBRARY_NAME}.js`, `${LIBRARY_NAME}.d.ts`];

const DIRS_TO_COPY = [
  `${LIBRARY_NAME}.android.node`,
  `${LIBRARY_NAME}.apple.node`, // Copy if it exists
];

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${path.relative(PACKAGES_DIR, dir)}`);
  }
}

function copyFileIfExists(source, target) {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    console.log(`📄 Copied: ${path.basename(source)}`);
    return true;
  } else {
    console.log(`⚠️  Skipped (not found): ${path.basename(source)}`);
    return false;
  }
}

function copyDirectoryIfExists(source, target) {
  if (fs.existsSync(source)) {
    fs.cpSync(source, target, { recursive: true, force: true });
    console.log(`📁 Copied directory: ${path.basename(source)}`);
    return true;
  } else {
    console.log(`⚠️  Skipped directory (not found): ${path.basename(source)}`);
    return false;
  }
}

function createPackageJson() {
  const packageJson = {
    name: "@react-native-node-api/rn-chia-wallet-sdk",
    private: true,
    type: "commonjs",
    version: "0.27.2",
    description: "React Native bindings for Chia Wallet SDK",
    homepage: "https://github.com/callstackincubator/react-native-node-api",
    repository: {
      type: "git",
      url: "git+https://github.com/callstackincubator/react-native-node-api.git",
      directory: "packages/rn-chia-wallet-sdk",
    },
    main: `${LIBRARY_NAME}.js`,
    types: `${LIBRARY_NAME}.d.ts`,
    scripts: {
      "copy-from-build":
        "node ../chia-wallet-sdk/napi/scripts/copy-to-rn-package.js",
    },
    keywords: [
      "react-native",
      "node-api",
      "chia",
      "wallet",
      "blockchain",
      "cryptocurrency",
    ],
    peerDependencies: {
      "react-native": ">=0.60.0",
    },
  };

  const packageJsonPath = path.join(TARGET_DIR, "package.json");
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  console.log(`📦 Created: package.json`);
}

function createReadme() {
  const readme = `# RN Chia Wallet SDK

React Native bindings for the [Chia Wallet SDK](https://github.com/xch-dev/chia-wallet-sdk).

## Installation

This package is part of the \`react-native-node-api\` monorepo and is built from the \`chia-wallet-sdk\` source.

## Usage

\`\`\`typescript
import ChiaWalletSDK from '@react-native-node-api/rn-chia-wallet-sdk';

// Use the SDK functions...
const mnemonic = ChiaWalletSDK.generateMnemonic();
console.log('Generated mnemonic:', mnemonic);
\`\`\`

## Building

To rebuild this package from the source:

1. Go to \`packages/chia-wallet-sdk/napi\`
2. Run \`npm run build:rn:android\` (and/or \`npm run build:rn:ios\`)
3. Run \`npm run package:rn\`
4. Run \`npm run copy-to-rn-package\`

## Platform Support

- ✅ Android (ARM64, ARM32, x86, x86_64)
- 🚧 iOS (planned)

## Requirements

- React Native >= 0.60.0
- \`react-native-node-api\` host module

## Architecture

This package contains:
- \`${LIBRARY_NAME}.js\` - React Native loader
- \`${LIBRARY_NAME}.d.ts\` - TypeScript definitions
- \`${LIBRARY_NAME}.android.node/\` - Android native libraries
- \`${LIBRARY_NAME}.apple.node/\` - iOS native libraries (when built)
`;

  const readmePath = path.join(TARGET_DIR, "README.md");
  fs.writeFileSync(readmePath, readme);
  console.log(`📖 Created: README.md`);
}

function createGitignore() {
  const gitignore = `# Dependencies
node_modules/

# Build outputs
*.log

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;

  const gitignorePath = path.join(TARGET_DIR, ".gitignore");
  fs.writeFileSync(gitignorePath, gitignore);
  console.log(`🚫 Created: .gitignore`);
}

function main() {
  console.log(`🚀 Copying React Native package for ${LIBRARY_NAME}\n`);

  // Create target directory
  ensureDirectoryExists(TARGET_DIR);

  // Clean existing content (except node_modules)
  console.log("\n🧹 Cleaning existing files...");
  const existingFiles = fs.readdirSync(TARGET_DIR);
  for (const file of existingFiles) {
    if (file !== "node_modules" && file !== ".git") {
      const filePath = path.join(TARGET_DIR, file);
      fs.rmSync(filePath, { recursive: true, force: true });
      console.log(`🗑️  Removed: ${file}`);
    }
  }

  // Copy files
  console.log("\n📋 Copying files...");
  let copiedFiles = 0;

  for (const file of FILES_TO_COPY) {
    const source = path.join(SOURCE_DIR, file);
    const target = path.join(TARGET_DIR, file);
    if (copyFileIfExists(source, target)) {
      copiedFiles++;
    }
  }

  // Copy directories
  console.log("\n📁 Copying directories...");
  let copiedDirs = 0;

  for (const dir of DIRS_TO_COPY) {
    const source = path.join(SOURCE_DIR, dir);
    const target = path.join(TARGET_DIR, dir);
    if (copyDirectoryIfExists(source, target)) {
      copiedDirs++;
    }
  }

  // Create package files
  console.log("\n📝 Creating package files...");
  createPackageJson();
  createReadme();
  createGitignore();

  // Summary
  console.log("\n🎉 Package copy complete!");
  console.log(`\nSummary:`);
  console.log(`   📄 Files copied: ${copiedFiles}/${FILES_TO_COPY.length}`);
  console.log(`   📁 Directories copied: ${copiedDirs}/${DIRS_TO_COPY.length}`);
  console.log(
    `   📦 Package location: ${path.relative(process.cwd(), TARGET_DIR)}`,
  );

  console.log(`\nTo use in test-app:`);
  console.log(
    `   1. Add to package.json dependencies: "rn-chia-wallet-sdk": "*"`,
  );
  console.log(`   2. Run: npm install`);
  console.log(
    `   3. Import: const ChiaWalletSDK = require('rn-chia-wallet-sdk');`,
  );

  if (copiedFiles === 0 && copiedDirs === 0) {
    console.log("\n⚠️  Warning: No files or directories were copied!");
    console.log("   Make sure to run the build and packaging commands first:");
    console.log("   1. npm run build:rn:android");
    console.log("   2. npm run package:rn");
    process.exit(1);
  }
}

main();
