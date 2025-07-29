# Chia Wallet SDK for React Native

This package provides React Native bindings for the Chia Wallet SDK, allowing you to build Chia blockchain applications in React Native.

## Prerequisites

1. **react-native-node-api**: This package is required to load native modules in React Native
   ```bash
   npm install react-native-node-api
   ```

2. **React Native CLI or Expo**: Make sure you have a React Native development environment set up

3. **Build tools**: For building the native components:
   - **iOS**: Xcode and iOS development tools
   - **Android**: Android NDK and build tools
   - **Rust**: Rust toolchain with mobile targets

## Building for React Native

### 1. Install Rust Mobile Targets

```bash
# iOS targets
rustup target add aarch64-apple-ios aarch64-apple-ios-sim

# Android targets
rustup target add aarch64-linux-android x86_64-linux-android
```

### 2. Set up Android NDK (for Android builds)

Make sure you have the Android NDK installed and the `ANDROID_NDK_HOME` environment variable set.

### 3. Build the React Native Packages

```bash
cd packages/chia-wallet-sdk/napi

# Build for both iOS and Android
npm run build:rn

# Or build platforms individually:
npm run build:rn:ios      # iOS only
npm run build:rn:android  # Android only
```

This will create:
- `chia-wallet-sdk.apple.node/` - iOS framework
- `chia-wallet-sdk.android.node/` - Android libraries
- `chia-wallet-sdk.js` - React Native loader
- `chia-wallet-sdk.d.ts` - TypeScript definitions

## Using in React Native

### 1. Copy Files to Your React Native Project

Copy the generated files to your React Native project:

```bash
# Copy the platform-specific directories and loader files
cp -r chia-wallet-sdk.apple.node/ /path/to/your/rn-project/
cp -r chia-wallet-sdk.android.node/ /path/to/your/rn-project/
cp chia-wallet-sdk.js /path/to/your/rn-project/
cp chia-wallet-sdk.d.ts /path/to/your/rn-project/
```

### 2. Install react-native-node-api

```bash
cd /path/to/your/rn-project
npm install react-native-node-api
```

### 3. Import and Use

```typescript
// Import the Chia Wallet SDK
const ChiaWalletSDK = require('./chia-wallet-sdk');

// Use the SDK (TypeScript support included)
const clvm = new ChiaWalletSDK.Clvm();
const address = ChiaWalletSDK.Address.decode('xch1...');
```

## Example Usage

```typescript
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

const ChiaWalletSDK = require('./chia-wallet-sdk');

export default function ChiaExample() {
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    try {
      // Create a new CLVM instance
      const clvm = new ChiaWalletSDK.Clvm();

      // Generate a random key pair
      const keyPair = ChiaWalletSDK.BlsPair.fromSeed(BigInt(Date.now()));

      // Create an address from the public key
      const puzzleHash = ChiaWalletSDK.standardPuzzleHash(keyPair.pk);
      const addr = new ChiaWalletSDK.Address(puzzleHash, 'xch');

      setAddress(addr.encode());
    } catch (error) {
      console.error('Chia SDK Error:', error);
    }
  }, []);

  return (
    <View>
      <Text>Generated Chia Address:</Text>
      <Text>{address}</Text>
    </View>
  );
}
```

## File Structure

After building and copying, your React Native project should have:

```
your-rn-project/
├── chia-wallet-sdk.js              # Main loader
├── chia-wallet-sdk.d.ts            # TypeScript definitions
├── chia-wallet-sdk.apple.node/     # iOS native code
│   ├── react-native-node-api-module
│   └── chia-wallet-sdk.framework/
│       ├── Info.plist
│       └── chia-wallet-sdk
└── chia-wallet-sdk.android.node/   # Android native code
    ├── react-native-node-api-module
    ├── arm64-v8a/
    │   └── libchia-wallet-sdk.so
    └── x86_64/
        └── libchia-wallet-sdk.so
```

## Troubleshooting

### Build Issues

1. **Missing Rust targets**: Make sure you've installed the required Rust targets
2. **Android NDK not found**: Set `ANDROID_NDK_HOME` environment variable
3. **iOS build fails**: Make sure you're building on macOS with Xcode installed

### Runtime Issues

1. **"react-native-node-api host module not found"**: Make sure `react-native-node-api` is properly installed and linked
2. **Module loading fails**: Verify the platform-specific directories are in the correct location
3. **TypeScript errors**: Make sure you're importing the correct type definitions

### Platform-Specific Notes

- **iOS**: Requires macOS with Xcode for building
- **Android**: Requires Android NDK to be installed
- **Simulator**: iOS simulator builds are included for testing

## API Reference

The API is identical to the Node.js version of the Chia Wallet SDK. Refer to the main documentation at [docs.rs/chia-wallet-sdk](https://docs.rs/chia-wallet-sdk) for detailed API information.

All classes and functions from the Rust crate are available through the JavaScript/TypeScript interface with full type safety.