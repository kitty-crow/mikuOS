import { boot } from "./boot.js";
import { isExe } from "../asm/fmt.js";
import { DirTree } from "./dir.js";
import type { Host } from "./boot.js";
import { hostConfig } from "./config.js";
import { LineEditor } from "../sh/editor.js";
import { localSessionPlan, superviseLocalLogin } from "./session.js";
import { rootPkg } from "./pkg.js";
import { cachedTetoProvider, kernelMode } from "../teto/provider.js";
import type { TetoImageProvider, TetoVariant } from "../teto/loader.js";

interface Hp {
  argv: string[];
  stdin: {
    isTTY?: boolean;
    setEncoding(x: string): void;
    setRawMode?(x: boolean): void;
    on(e: string, fn: (x?: string) => void): void;
    resume(): void;
    pause(): void;
  };
  stdout: { columns?: number; rows?: number; write(s: string): void; on?(e: string, fn: () => void): void };
  stderr: { write(s: string): void };
  on(e: string, fn: () => void): void;
  env?: Record<string, string | undefined>;
  exitCode?: number;
}
interface BunHost { file(p: string): { arrayBuffer(): Promise<ArrayBuffer> }; }
interface HostFs { readFile(p: string): Promise<Uint8Array>; }

const hp = (globalThis as unknown as { process: Hp }).process;
const bh = (globalThis as unknown as { Bun?: BunHost }).Bun;
const config = await hostConfig();
const session = localSessionPlan(config);
const kernelArg = hp.argv.find(value => value.startsWith("--kernel="))?.slice("--kernel=".length);
const kernelIndex = hp.argv.indexOf("--kernel");
const requestedKernel = kernelMode(kernelArg ?? (kernelIndex >= 0 ? hp.argv[kernelIndex + 1] : hp.env?.MIKUOS_KERNEL), "teto");
if (kernelIndex >= 0 && !hp.argv[kernelIndex + 1]) throw new Error("--kernel needs thistle, teto or auto");
const tetoRoot = new URL("../../dist/teto/", import.meta.url);
const rawTetoProvider: TetoImageProvider = {
  async load(variant: TetoVariant): Promise<Uint8Array<ArrayBuffer>> {
    const name = variant === "threads" ? "teto-threads.wasm" : "teto.wasm";
    const url = new URL(name, tetoRoot);
    const bytes = bh
      ? new Uint8Array(await bh.file(url.pathname).arrayBuffer())
      : Uint8Array.from(await (await import("node:fs/promises" as string) as unknown as HostFs).readFile(url.pathname));
    return Uint8Array.from(bytes);
  },
};
const tetoProvider = requestedKernel === "thistle" ? undefined : cachedTetoProvider(rawTetoProvider);
let live = true;
const noRoot = hp.argv.includes("--no-root"), di = hp.argv.indexOf("--root");
const root = di >= 0 ? hp.argv[di + 1] : hp.env?.MIKUOS_ROOT ?? hp.env?.THISTLE_ROOT ?? new URL("../../.thistle", import.meta.url);
if (di >= 0 && !root) throw new Error("--root needs a host directory path");
const host: Host = {
  put: (s, ch) => (ch === "err" ? hp.stderr : hp.stdout).write(s),
  halt: () => { live = false; hp.stdin.setRawMode?.(false); hp.stdin.pause(); },
  config,
  account: session.account,
  setId: true,
  kernelMode: requestedKernel,
  ...(tetoProvider ? { teto: tetoProvider } : {}),
};
if (session.command && !hp.stdin.isTTY) {
  throw new Error("local login mode requires a terminal");
}
if (!noRoot) {
  host.tree = new DirTree(root!);
  host.pkg = rootPkg;
}
const os = boot(host);

const resize = (): void => os.resize(hp.stdout.rows ?? 24, hp.stdout.columns ?? 80);
resize();
hp.stdout.on?.("resize", resize);
await os.hello();

const wi = hp.argv.findIndex(x => x === "--wasm" || x === "--bin");
if (wi >= 0) {
  const src = hp.argv[wi + 1];
  if (!src) throw new Error(`${hp.argv[wi]} needs a host file path`);
  const x = bh ? new Uint8Array(await bh.file(src).arrayBuffer()) : await (await import("node:fs/promises" as string) as unknown as HostFs).readFile(src);
  const wasm = WebAssembly.validate(Uint8Array.from(x) as BufferSource);
  if (hp.argv[wi] === "--wasm" ? !wasm : !wasm && !isExe(x)) throw new Error(`${src} is not a supported guest binary`);
  const name = hp.argv[wi + 2] ?? src.split(/[\\/]/).at(-1) ?? "guest.bin";
  const p = os.load(name, x);
  await os.flush();
  hp.stdout.write(`Loaded host binary at ${p}\r\n`);
}

let chain = Promise.resolve();

if (!hp.stdin.isTTY) {
  let buf = "";
  hp.stdin.setEncoding("utf8");
  hp.stdin.on("data", x => {
    buf += x ?? "";
    const a = buf.split(/\r?\n/); buf = a.pop() ?? "";
    for (const line of a) chain = chain.then(async () => { if (live) hp.exitCode = await os.run(line); });
  });
  hp.stdin.on("end", () => { if (buf && live) chain = chain.then(async () => { hp.exitCode = await os.run(buf); }); });
  hp.stdin.resume();
} else {
  os.sh.ensureUserState(true);
  let editor: LineEditor;
  let sessionStarting = session.kind === "login";
  const execute = (src: string, bodies: readonly string[]): void => {
    chain = chain.then(async () => {
      if (!live) return;
      hp.exitCode = await os.run(src, bodies);
      editor.afterCommand();
    }).catch(error => {
      hp.stderr.write(`${error instanceof Error ? error.message : String(error)}\r\n`);
      editor.afterCommand();
    });
  };
  editor = new LineEditor({
    shell: os.sh,
    prompt: () => os.prompt(),
    busy: () => sessionStarting || os.busy,
    write: text => hp.stdout.write(text),
    execute,
    passthrough: data => os.input(data),
    halt: () => host.halt?.(),
    complete: line => os.complete(line),
  });
  hp.stdin.setEncoding("utf8");
  hp.stdin.setRawMode?.(true);
  hp.stdin.on("data", value => editor.key(value ?? ""));
  hp.on("SIGINT", () => editor.key("\x03"));
  hp.on("exit", () => hp.stdin.setRawMode?.(false));
  hp.stdin.resume();

  if (session.command) {
    chain = superviseLocalLogin(session, {
      live: () => live,
      run: command => os.run(command, [], false),
      unavailable: () => {
        hp.stderr.write("Local login mode requires an installed /bin/login.\r\n");
        host.halt?.();
      },
    }).catch(error => {
      sessionStarting = false;
      hp.stderr.write(`${error instanceof Error ? error.message : String(error)}\r\n`);
      host.halt?.();
    });
  } else {
    sessionStarting = false;
    editor.render();
  }
}
