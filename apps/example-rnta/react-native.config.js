// const path = require('path');
// const hostPkg = require('../../packages/react-native-node-api-host/package.json');

// const monorepoDependencies = {
//   [hostPkg.name]: {
//     root: path.join(__dirname, '..', '..', 'packages', hostPkg.name),
//     platforms: {
//       // Codegen script incorrectly fails without this
//       // So we explicitly specify the platforms with empty object
//       android: {},
//       ios: {},
//     },
//   },
// };

const project = (() => {
  try {
    const { configureProjects } = require("react-native-test-app");
    const project = configureProjects({
      android: {
        sourceDir: "android",
      },
      ios: {
        sourceDir: "ios",
        automaticPodsInstallation: true,
      },
      windows: {
        sourceDir: "windows",
        solutionFile: "windows/react-native-node-api-modules-example.sln",
      },
    });
    return {
      ...project,
      // dependencies: {
      //   ...(project.dependencies),
      //   ...monorepoDependencies,
      // },
    };
  } catch {
    return undefined;
  }
})();

module.exports = {
  ...(project ? { project } : undefined),
};
