const addon = require("vendor/node-bcrypt/bcrypt_lib.node");

const randomBytes = (size) =>
  Uint8Array.from({ length: size }, () => Math.floor(Math.random() * 256));

const ROUNDS = 10;
const MINOR = "b";

const hash = addon.gen_salt_sync(MINOR, ROUNDS, randomBytes(16));
console.log(`Generated hash for (${MINOR}, ${ROUNDS}): ${hash}`);

const receivedRounds = addon.get_rounds(hash);
console.log(`Read Rounds back from hash: ${receivedRounds}`);
