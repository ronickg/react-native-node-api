import path from "node:path";

import { spawn, SpawnFailure } from "bufout";
import { Client } from "mocha-remote-client";

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

process.once("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down metro server...");
  metro.kill();
});

// Create a client, which will automatically connect to the server on the default port (8090)
const client = new Client({
  // Called when the server asks the client to run
  tests: () => {
    // write your tests here or require a package that calls the mocha globals
    describe("my thing", () => {
      it("works", async () => {
        // yay!
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });
    });
  },
});

metro.catch((err) => {
  if (!(err instanceof SpawnFailure)) {
    throw err;
  }
});
