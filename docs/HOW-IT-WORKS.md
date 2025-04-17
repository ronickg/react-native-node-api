# How it works

This document will outline what happens throughout the various parts of the system, when the app calls the `add` method on the library introduced in the ["usage" document](./USAGE.md).

## `my-app` makes an `import`

Everything starts from the consuming app importing the `calculator-lib`.
Metro handles the resolution and the `calculator-lib`'s entrypoint is added to the JavaScript-bundle when bundling.

## `calculator-lib` does `require("./prebuild.node")`, the bundler resolves `./prebuild.node` and we generate JavaScript to load it

The library has a require call to a `.node` file, which would normally not have any special meaning, but because the app developer has added the `resolveRequest` function from the `react-native-node-api-modules/metro-config`, the resolution gets intercepted when the app is being bundled by Metro and resolved by the `react-native-node-api-modules` package.

> [!NOTE]  
> While this flow is supported through Metro only, we want to generalize and support multiple alternative bundlers too.

The generated code is platform specific and looks something like this:

```javascript
// When resolving with `platform === "ios"`
import { loadModuleOnApple } from "react-native-node-api-modules";
export default loadModuleOnApple({
  xcframeworkPath: "../../prebuild.node.xcframework",
  frameworkName: "MyAddon.framework",
  dylibName: "MyAddon",
});
```

```javascript
// When resolving with `platform === "android"`
import { loadModuleOnAndroid } from "react-native-node-api-modules";
export default loadModuleOnAndroid({
  libsPath: "../../prebuild.node.android",
  soName: "my-addon.so",
});
```

<!-- The exact shape and location of this generated code is TDB -->

## Generated code calls into `react-native-node-api-modules`, which loads the platform specific dynamic library

The native implementation of `loadModuleOnApple` and `loadModuleOnAndroid` is responsible for loading the dynamic library and allow the Node-API module to register its initialization function, either by exporting a `napi_register_module_v1` function or by calling the (deprecated) `napi_module_register` function.
In any case the native code stores the initialization function in a static data-structure.

## `react-native-node-api-modules` creates a `node_env` and initialize the Node-API module

The initialization function of a Node-API module expects a `node_env`.
If we don't have one for the current `jsi::Runtime` already, one is created, by calling `createNodeApiEnv` on the `jsi::Runtime`.

## The library's C++ code initialize the `exports` object

An `exports` object is created for the Node-API module and both the `napi_env` and `exports` object is passed to the Node-API module's initialization function and the third party code is able to call the Node-API free functions:

- The engine-specific functions (see [js_native_api.h](https://github.com/nodejs/node/blob/main/src/js_native_api.h)) are implemented by the `jsi::Runtime` (currently only Hermes supports this).
- The runtime-specific functions (see [node_api.h](https://github.com/nodejs/node/blob/main/src/node_api.h)) are implemented by `react-native-node-api-modules`.

## `my-app` regain control and call `add`

When the `exports` object is populated by `calculator-lib`'s Node-API module, control is returned to `react-native-node-api-modules` which returns the `exports` object to JavaScript, with the `add` function defined on it.

```javascript
import { add } from "calculator-lib";
console.log("1 + 2 =", add(1, 2));
```

## The library's C++ code execute the native function

Now that the app's JavaScript call the `add` function, the JavaScript engine will know to call the associated native function, which was setup during the initialization of the Node-API module and the native `Add` function is executed and control returned to JavaScript again.
