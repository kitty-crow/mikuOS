import { spawn } from "node:child_process";
import { access, mkdir, open, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT_IMAGE_VERSION } from "./image.js";
import { sharedSeedSnapshot } from "./sharedseed.js";

interface EnsureSharedOptions {
  endpoint?: string;
  token?: string;
  store?: string;
  seedRoot?: string | URL;
  fallbackRoot?: string | URL;
  port?: number;
}

const healthy = async (endpoint: URL, token?: string): Promise<boolean> => {
  try {
    const response = await fetch(new URL("v1/health", endpoint), {
      cache: "no-store",
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const fileExists = async (path: string): Promise<boolean> => {
  try { await access(path, constants.R_OK); return true; }
  catch (error) { if ((error as { code?: string }).code === "ENOENT") return false; throw error; }
};

export const ensureSharedUserspace = async (
  options: EnsureSharedOptions = {},
): Promise<{ endpoint: string; token?: string }> => {
  if (options.endpoint) return { endpoint: options.endpoint, ...(options.token ? { token: options.token } : {}) };

  const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
  const port = options.port ?? Number(process.env.MIKUOS_FS_PORT ?? 3939);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid MIKUOS_FS_PORT: ${port}`);
  const endpoint = new URL(`http://127.0.0.1:${port}/`);
  const token = options.token ?? process.env.MIKUOS_FS_TOKEN;
  if (await healthy(endpoint, token)) return { endpoint: endpoint.href, ...(token ? { token } : {}) };

  const store = resolve(options.store ?? process.env.MIKUOS_FS_STORE ?? `${projectRoot}/.mikuos-authority`);
  const seedPath = resolve(store, "seed.json");
  await mkdir(store, { recursive: true });
  if (!(await fileExists(seedPath))) {
    const selected = options.seedRoot ?? process.env.MIKUOS_ROOT ?? process.env.THISTLE_ROOT ?? new URL("../../.thistle/", import.meta.url);
    const fallback = options.fallbackRoot ?? new URL("../../.thistle.base/", import.meta.url);
    const snapshot = await sharedSeedSnapshot(selected, ROOT_IMAGE_VERSION) ?? await sharedSeedSnapshot(fallback, ROOT_IMAGE_VERSION);
    if (!snapshot) throw new Error("could not seed the authoritative mikuOS userspace from .thistle or .thistle.base");
    await writeFile(seedPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" }).catch(async error => {
      if ((error as { code?: string }).code !== "EEXIST") throw error;
    });
  }

  const daemon = fileURLToPath(new URL("../../neru/src/fs/daemon-cli.ts", import.meta.url));
  const logPath = resolve(store, "daemon.log");
  const log = await open(logPath, "a");
  const executable = process.execPath;
  const args = ["run", daemon, "--store", store, "--host", "127.0.0.1", "--port", String(port), "--seed", seedPath];
  if (token) args.push("--token", token);
  const child = spawn(executable, args, {
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
    cwd: dirname(projectRoot),
    env: process.env,
  });
  child.unref();
  await log.close();

  for (let attempt = 0; attempt < 100; attempt++) {
    if (await healthy(endpoint, token)) return { endpoint: endpoint.href, ...(token ? { token } : {}) };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`authoritative mikuOS userspace service did not start; see ${logPath}`);
};
