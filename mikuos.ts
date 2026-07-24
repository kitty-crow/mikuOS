// Bun runs TypeScript directly, so this compatibility name selects the host.
// The direct legacy entry remains in thistle.ts: import "./src/main/cli.ts"
import { neruCliRequest, runNeruCli } from "./src/backends/neru/cli.js";

const request = neruCliRequest(process.argv.slice(2), process.env);
if (request) {
  process.exitCode = await runNeruCli(request);
} else {
  await import("./src/main/cli.js");
}
