import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const includeSourcePath = new URL(import.meta.resolve("node-api-headers/include")).pathname;
const includeDestinationPath = path.join(import.meta.dirname, "include");
assert(fs.existsSync(includeSourcePath), `Expected ${includeSourcePath}`);
console.log(`Copying ${includeSourcePath} to ${includeDestinationPath}`);
fs.cpSync(includeSourcePath, includeDestinationPath, { recursive: true });
