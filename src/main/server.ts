import { hostConfig } from "./config.js";

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
};

const extension = (path: string): string => {
  const index = path.lastIndexOf(".");
  return index < 0 ? "" : path.slice(index);
};

const allowed = (path: string): boolean =>
  path === "/index.html" ||
  path === "/style.css" ||
  path === "/thistle.js" ||
  path === "/mikuos.config.json" ||
  path === "/thistle.config.json" ||
  path === "/teto-test.html" ||
  path === "/teto-test.js" ||
  path.startsWith("/vendor/") ||
  path.startsWith("/assets/") ||
  path.startsWith("/teto/");

export const app = bun.serve({
  hostname,
  port,
  fetch(request): Response {
    const url = new URL(request.url);
    let path: string;

    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return new Response("bad path", { status: 400 });
    }

    if (path === "/") path = "/index.html";
    if (
      (request.method !== "GET" && request.method !== "HEAD") ||
      path.includes("..") ||
      !allowed(path)
    ) {
      return new Response("not found", { status: 404 });
    }

    return new Response(bun.file(new URL(`.${path}`, staticRoot)), {
      headers: {
        "content-type": mime[extension(path)] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
      },
    });
  },
});

console.log(
  `${config.os.prettyName} static web preview: ${app.url}`,
);
