import { createRequire } from "node:module";
import { cpSync, rmSync } from "node:fs";
import path from "node:path";

import { EXAMPLES_DIR } from "./cmake-projects.mjs";

const ALLOW_LIST = [
  // "1-getting-started/1_hello_world/napi/",
  "1-getting-started/2_function_arguments/napi/",
  // "1-getting-started/3_callbacks/napi/",
  // "1-getting-started/4_object_factory/napi/"
];

console.log("Copying files to", EXAMPLES_DIR);
// Clean up the destination directory before copying
rmSync(EXAMPLES_DIR, { recursive: true, force: true });

const require = createRequire(import.meta.url);

const EXAMPLES_PACKAGE_PATH = require.resolve(
  "node-addon-examples/package.json"
);
const SRC_DIR = path.join(path.dirname(EXAMPLES_PACKAGE_PATH), "src");
console.log("Copying files from", SRC_DIR);

for (const src of ALLOW_LIST) {
  const srcPath = path.join(SRC_DIR, src);
  const destPath = path.join(EXAMPLES_DIR, src);
  console.log("Copying from", srcPath, "to", destPath);
  cpSync(srcPath, destPath, { recursive: true });
}
