import assert from "node:assert/strict";
import path from "node:path";

import { spawn } from "bufout";

// Ideally, we would just use "concurrently" or "npm-run-all" to run these in parallel but:
// - "concurrently" hangs the emulator action on Ubuntu
// - "npm-run-all" shows symptoms of not closing metro when Mocha Remote sends a SIGTERM

const platform = process.argv[2];
assert(
  platform === "android" || platform === "ios",
  "Platform must be 'android' or 'ios'"
);

const cwd = path.resolve(__dirname, "..");
const env = {
  ...process.env,
  FORCE_COLOR: "1",
};

const metro = spawn("react-native", ["start", "--no-interactive"], {
  cwd,
  stdio: "inherit",
  outputPrefix: "[metro] ",
  env,
});

const build = spawn(
  "react-native",
  [
    `run-${platform}`,
    "--no-packager",
    ...(platform === "android" ? ["--active-arch-only"] : []),
  ],
  {
    cwd,
    stdio: "inherit",
    outputPrefix: `[${platform}] `,
    env,
  }
);

Promise.all([metro, build]).catch(console.error);
