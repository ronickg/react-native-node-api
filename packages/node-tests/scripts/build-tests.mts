import path from "node:path";

import { spawn, SpawnFailure } from "bufout";

import { findCMakeProjects } from "./utils.mjs";

const rootPath = path.join(import.meta.dirname, "..");
const projectPaths = findCMakeProjects();

await Promise.all(
  projectPaths.map(async (projectPath) => {
    console.log(
      `Running "cmake-rn" in ${path.relative(
        rootPath,
        projectPath
      )} to build for React Native`
    );
    await spawn("cmake-rn", [], { cwd: projectPath, outputMode: "buffered" });
  })
).catch((err) => {
  process.exitCode = 1;
  if (err instanceof SpawnFailure) {
    err.flushOutput("both");
  } else if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
});
