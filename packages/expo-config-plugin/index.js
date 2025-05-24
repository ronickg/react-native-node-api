/* eslint-disable @typescript-eslint/no-unused-vars */
const { withPodfile } = require("@expo/config-plugins");

/**
 * @type {import("expo/config-plugins").ConfigPlugin<unknown>}
 *
 * @see https://docs.expo.dev/config-plugins/plugins-and-mods/#create-a-plugin
 */
const withNodeAPI = (config, props) => {
  // https://docs.expo.dev/config-plugins/plugins-and-mods/#create-a-mod
  return withPodfile(config, async (config) => {
    console.log("DEBUGGING withNodeAPI...");
    console.dir(config, { depth: null });
    // config.modResults = TODO
    return config;
  });
};

exports.default = withNodeAPI;
