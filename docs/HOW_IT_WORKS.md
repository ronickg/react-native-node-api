# How does React Native Node-API Modules work?

The purpose of this document is to explain how Node-API modules are supported all the way from an app loading a library package to the library's native code returning a JavaScript value to from a function call.

For the purpose of the explanation, we'll introduce a two fictitious packages:
- `calculator-lib`: A package publishing a Node-API module.
- `my-app`: An app depending on `calculator-lib`.

## Steps needed for the app developer

```bash
npm install --save calculator-lib react-native-node-api-modules
```

The app developer has to install both `calculator-lib` as well as `react-native-node-api-modules`.
The reason for the latter is a current limitation of the React Native Community CLI which doesn't consider transitive dependencies when enumerating packages for auto-linking.

> [!WARNING]
>  It's important to match the exact version of the `react-native-node-api-modules` declared as peer dependency by `calculator-lib`.

For the app to resolve the Node-API dynamic library files, the app developer must update their Metro config to use a `requireRequest` function exported from `react-native-node-api-modules`:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const nodeApi = require("react-native-node-api-modules/metro-config");
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  resolver: { resolveRequest: nodeApi.resolveRequest },
});
```

At some point the app code will import (or require) the entrypoint of `calculator-lib`:

```javascript
import { add } from "calculator-lib";
console.log("2 + 2 =", add(2, 2));
```

We will be implementing this `add` function.

## Steps needed for the author of the `calculator-lib` library

### Install `react-native-node-api-modules` as a dev-dependency and declare a peer dependency

```bash
npm install react-native-node-api-modules --save-dev --save-exact
```

Update the package.json of your library to add a peer dependency on the package as well:

```bash
# Update the command to use the exact version you installed as dev-dependency
npm pkg set peerDependencies.react-native-node-api-modules=1.2.3
```

### Implement native code

You can really use any language able to produce prebuilt binaries in the expected format with support for calling the Node-API FFI. See the [documentation on prebuilds](./PREBUILDS.md) for the specifics on the expected names and format of these.

For the sake of simplicity, this document use a simple native module implemented in C++.

```cpp
// TODO: Write the module code
```

### Build the prebuilt binaries

<!-- TODO: Write this -->

### Load and export the native module

```javascript
module.exports = require("./prebuild.node");
```

## Tracing a call to `add`

<!-- TODO: Write this -->

### `my-app` makes an `import`

<!-- TODO: Write this -->

### `calculator-lib` does `require("./prebuild.node")`

<!-- TODO: Write this -->

### Metro resolves the `./prebuild.node` and generates loading JavaScript

<!-- TODO: Write this -->

### Generated code calls into `react-native-node-api-modules`

<!-- TODO: Write this -->

### `react-native-node-api-modules` loads the platform specific dynamic library

<!-- TODO: Write this -->

### `react-native-node-api-modules` register the Node-API module

<!-- TODO: Write this -->

### `react-native-node-api-modules` creates a `node_env`

<!-- TODO: Write this, detailing the call of `jsi::Runtime::createNodeApiEnv` -->

### `react-native-node-api-modules` initialize the Node-API module

<!-- TODO: Write this -->

### The library's C++ code initialize the `exports` object

<!-- TODO: Write this -->
<!-- TODO: Mention the engine-specific symbols being implemented by Hermes -->

### `my-app` regain control and call `add`

<!-- TODO: Write this -->

### The library's C++ code execute the native function

<!-- TODO: Write this -->
