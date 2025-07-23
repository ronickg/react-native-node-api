# Node Addon Examples (`@react-native-node-api/node-addon-examples`)

We're using the [nodejs/node-addon-examples](https://github.com/nodejs/node-addon-examples) repository from the Node.js project as tests for our Node-API implementation and this package is a wrapper around those, using `gyp-to-cmake` and `cmake-rn` to prepare prebuilds and scaffolding for loading the addons.

The main purpose is to use these as tests to verify the implementation: We choose to use this as our first signal for compliance, over the [js-native-api](https://github.com/nodejs/node/tree/main/test/js-native-api) tests in the Node.js project, because the examples depends much less on Node.js built-in runtime APIs. A drawback is that these examples were not built as tests with assertions, but examples using console logging to signal functionality and we work around this limitation by wrapping the loading of the example JS code with a console.log stub implementation which buffer and asserts messages printed by the addon.

This package is imported by our [test app](../../apps/test-app).
