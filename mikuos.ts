// Select the host without changing the normal Thistle/Teto CLI.
import { neruCliRequest, runNeruCli } from "./src/backends/neru/cli.js";

const request = neruCliRequest(process.argv.slice(2), process.env);
if (request) {
  process.exitCode = await runNeruCli(request);
} else {
  await import("./src/main/cli.ts");
}
