# Prebuilds

This document will codify the naming and directory structure of prebuilt binaries, expected by the `react-native-node-api-modules` package and tools.

To align with prior art and established patterns around the distribution of Node-API modules for Node.js (and other engines supporting this),

## Apple: XCFrameworks of dynamic libraries in frameworks

The Apple Developer documentation on ["Creating a multiplatform binary framework bundle"](https://developer.apple.com/documentation/xcode/creating-a-multi-platform-binary-framework-bundle#Avoid-issues-when-using-alternate-build-systems) mentions:

> An XCFramework can include dynamic library files, but only macOS supports these libraries for dynamic linking. Dynamic linking on iOS, watchOS, and tvOS requires the XCFramework to contain .framework bundles.

<!-- TODO: Write this -->

## Android: Directory of architecture specific directories of shared object library files.

<!-- TODO: Write this -->
