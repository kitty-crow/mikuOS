// Bun runs TypeScript directly, so this compatibility name selects the host.
import { neruCliRequest, runNeruCli } from "./src/backends/neru/cli.js";

const request = neruCliRequest(process.argv.slice(2), process.env);
if (request) {
  process.exitCode = await runNeruCli(request);
} else {
  await import("./src/main/cli.js");
}
