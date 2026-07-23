import { hostConfig } from "./config.js";
import { ensureSharedUserspace } from "./sharedaemon.js";

interface BServer {
  readonly url: URL;
  stop(): void;
}

interface BHost {
  file(path: string | URL): Blob;
  serve(options: {
    hostname: string;
    port: number;
    fetch(request: Request): Response | Promise<Response>;
  }): BServer;
}

interface Proc { env?: Record<string, string | undefined>; }

const bun = (globalThis as unknown as { Bun: BHost }).Bun;
const proc = (globalThis as unknown as { process?: Proc }).process;
const staticRoot = new URL("../../dist/web/", import.meta.url);
const port = Number(proc?.env?.PORT ?? 3000);
const hostname = proc?.env?.HOST ?? "127.0.0.1";
const config = await hostConfig();
const shared = await ensureSharedUserspace({
  endpoint: proc?.env?.MIKUOS_FS_URL,
  token: proc?.env?.MIKUOS_FS_TOKEN,
  store: proc?.env?.MIKUOS_FS_STORE,
});
const sharedConfig = {
  ...config,
  storage: {
    ...config.storage,
    shared: {
      url: "./mikuos-fs/",
      required: true,
    },
  },
};

const mime: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".tho": "application/x-thistle-object",
  ".39": "application/x-thistle-executable",
  ".thx": "application/x-thistle-executable",
  ".txe": "application/x-thistle-executable",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
};

const extension = (path: string): string => {
  const index = path.lastIndexOf(".");
  return index < 0 ? "" : path.slice(index);
};

const allowed = (path: string): boolean =>
  path === "/index.html" ||
  path === "/coi-serviceworker.js" ||
  path === "/style.css" ||
  path === "/thistle.js" ||
  path === "/neru-entry.js" ||
  path === "/mikuos.config.json" ||
  path === "/thistle.config.json" ||
  path === "/teto-test.html" ||
  path === "/teto-test.js" ||
  path.startsWith("/vendor/") ||
  path.startsWith("/assets/") ||
  path.startsWith("/teto/") ||
  path.startsWith("/neru/");

const isolationHeaders = (): Headers => {
  const headers = new Headers();
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-embedder-policy", "require-corp");
  headers.set("cross-origin-resource-policy", "same-origin");
  return headers;
};

const proxyShared = async (request: Request, url: URL): Promise<Response> => {
  const suffix = url.pathname.slice("/mikuos-fs/".length);
  const target = new URL(`${suffix}${url.search}`, shared.endpoint);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("authorization");
  if (shared.token) headers.set("authorization", `Bearer ${shared.token}`);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("cross-origin-resource-policy", "same-origin");
  responseHeaders.set("cache-control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};

export const app = bun.serve({
  hostname,
  port,
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);
    let path: string;

    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return new Response("bad path", { status: 400 });
    }

    if (path.startsWith("/mikuos-fs/")) return await proxyShared(request, url);
    if (path === "/") path = "/index.html";
    if (
      (request.method !== "GET" && request.method !== "HEAD") ||
      path.includes("..") ||
      !allowed(path)
    ) {
      return new Response("not found", { status: 404 });
    }

    if (path === "/mikuos.config.json") {
      const headers = isolationHeaders();
      headers.set("content-type", "application/json");
      headers.set("cache-control", "no-store");
      return new Response(`${JSON.stringify(sharedConfig, null, 2)}\n`, { headers });
    }

    const headers = isolationHeaders();
    headers.set("content-type", mime[extension(path)] ?? "application/octet-stream");
    return new Response(bun.file(new URL(`.${path}`, staticRoot)), { headers });
  },
});

console.log(
  `${config.os.prettyName} static web preview: ${app.url}\n` +
  `Authoritative userspace: ${shared.endpoint}`,
);
