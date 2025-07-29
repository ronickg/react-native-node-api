# RN Chia Wallet SDK

React Native bindings for the [Chia Wallet SDK](https://github.com/xch-dev/chia-wallet-sdk).

## Installation

This package is part of the `react-native-node-api` monorepo and is built from the `chia-wallet-sdk` source.

## Usage

```typescript
import ChiaWalletSDK from '@react-native-node-api/rn-chia-wallet-sdk';

// Use the SDK functions...
const mnemonic = ChiaWalletSDK.generateMnemonic();
console.log('Generated mnemonic:', mnemonic);
```

## Building

To rebuild this package from the source:

1. Go to `packages/chia-wallet-sdk/napi`
2. Run `npm run build:rn:android` (and/or `npm run build:rn:ios`)
3. Run `npm run package:rn`
4. Run `npm run copy-to-rn-package`

## Platform Support

- ✅ Android (ARM64, ARM32, x86, x86_64)
- 🚧 iOS (planned)

## Requirements

- React Native >= 0.60.0
- `react-native-node-api` host module

## Architecture

This package contains:
- `chia-wallet-sdk.js` - React Native loader
- `chia-wallet-sdk.d.ts` - TypeScript definitions
- `chia-wallet-sdk.android.node/` - Android native libraries
- `chia-wallet-sdk.apple.node/` - iOS native libraries (when built)
