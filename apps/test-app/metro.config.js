const { makeMetroConfig } = require("@rnx-kit/metro-config");
const { resolveRequest } = require("react-native-node-api-modules/metro-resolver");

module.exports = makeMetroConfig({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    resolveRequest,
  }
});
