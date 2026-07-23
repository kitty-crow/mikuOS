// Bun runs TypeScript directly, so this compatibility name selects the host.
import { ensureSharedUserspace } from "./src/main/shareddaemon.js";
import { neruCliRequest, runNeruCli } from "./src/backends/neru/cli.js";

const argv = process.argv.slice(2);
if (!argv.includes("--no-root") && process.env.MIKUOS_SHARED_DISABLE !== "1") {
  const shared = await ensureSharedUserspace({
    endpoint: process.env.MIKUOS_FS_URL,
    token: process.env.MIKUOS_FS_TOKEN,
    store: process.env.MIKUOS_FS_STORE,
  });
  process.env.MIKUOS_FS_URL = shared.endpoint;
  if (shared.token) process.env.MIKUOS_FS_TOKEN = shared.token;
}

const request = neruCliRequest(argv, process.env);
if (request) {
  process.exitCode = await runNeruCli(request);
} else {
  await import("./src/main/cli.js");
}
