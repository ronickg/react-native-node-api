
const project = (() => {
  try {
    const { configureProjects } = require("react-native-test-app");
    const project = configureProjects({
      ios: {
        sourceDir: "ios",
        // automaticPodsInstallation: false,
      },
      // android: {
      //   sourceDir: "android",
      // },
      // windows: {
      //   sourceDir: "windows",
      //   solutionFile: "windows/react-native-node-api-modules-example.sln",
      // },
    });
    return {
      ...project,
    };
  } catch {
    return undefined;
  }
})();

module.exports = {
  ...(project ? { project } : undefined),
};