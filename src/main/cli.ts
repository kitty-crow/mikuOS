// This module composes kernel, toolchain or integration-test boundaries and intentionally imports their contracts.
//@cg-expect-warning
import { ensure } from "../core/err.js";
import { hostModule } from "./host-module.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { boot } from "./boot.js";
import { isExe } from "../asm/fmt.js";
import { DirTree } from "./dir.js";
import type { Host } from "./boot.js";
import { hostConfig } from "./config.js";
import { LineEditor } from "../sh/editor.js";
import { localSessionPlan, superviseLocalLogin } from "./session.js";
import { cachedTetoProvider, kernelMode } from "../teto/provider.js";
import type { TetoImageProvider, TetoVariant } from "../teto/loader.js";

interface Hp {
  argv: string[];
  stdin: {
    isTTY: boolean | null;
    setEncoding(x: string): void;
    setRawMode: ((x: boolean) => void) | null;
    on(e: string, fn: (x: string | null) => void): void;
    resume(): void;
    pause(): void;
  };
  stdout: { columns: number | null; rows: number | null; write(s: string): void; on: ((e: string, fn: () => void) => void) | null; };
  stderr: { write(s: string): void };
  on(e: string, fn: () => void): void;
  env: Record<string, string | null> | null;
  exitCode: number | null;
}
interface BunHost { file(p: string): { arrayBuffer(): Promise<ArrayBuffer> }; }
interface HostFs { readFile(p: string): Promise<Uint8Array>; }

const hp = (globalThis as typeof globalThis & { process: Hp }).process;
const bh = (globalThis as typeof globalThis & { Bun: BunHost | null }).Bun;
const config = await hostConfig(null);
const session = localSessionPlan(config);
const kernelArg = (withValue((hp.argv.find(value => value.startsWith("--kernel=")) ?? null) ?? null, value => value.slice("--kernel=".length)) ?? null);
const kernelIndex = hp.argv.indexOf("--kernel");
const requestedKernel = kernelMode(kernelArg ?? (kernelIndex >= 0 ? (hp.argv[kernelIndex + 1] ?? null) : (withValue(hp.env ?? null, value => (value.MIKUOS_KERNEL ?? null)) ?? null)), "teto");
if (kernelIndex >= 0 && !(hp.argv[kernelIndex + 1] ?? null)) throw new Error("--kernel needs thistle, teto or auto");
const tetoRoot = new URL("../../dist/teto/", import.meta.url);
const rawTetoProvider: TetoImageProvider = {
  async load(variant: TetoVariant): Promise<Uint8Array<ArrayBuffer>> {
    const name = variant === "threads" ? "teto-threads.wasm" : "teto.wasm";
    const url = new URL(name, tetoRoot);
    const bytes = bh
      ? new Uint8Array(await bh.file(url.pathname).arrayBuffer())
      : Uint8Array.from(await (await hostModule("node:fs/promises")).readFile(url.pathname));
    return Uint8Array.from(bytes);
  },
};
const tetoProvider = requestedKernel === "thistle" ? null : cachedTetoProvider(rawTetoProvider);
let live = true;
const noRoot = hp.argv.includes("--no-root"), di = hp.argv.indexOf("--root");
const root = di >= 0 ? (hp.argv[di + 1] ?? null) : withValue(hp.env ?? null, value => (value.MIKUOS_ROOT ?? null)) ?? (withValue(hp.env ?? null, value => (value.THISTLE_ROOT ?? null)) ?? null) ?? new URL("../../.thistle", import.meta.url);
if (di >= 0 && !root) throw new Error("--root needs a host directory path");
const host: Host = {"tree": null, "requireTree": null, "pkg": null, "onBootProgress": null, put: (s, ch) => { (ch === "err" ? hp.stderr : hp.stdout).write(s); },
  halt: () => { live = false; withValue(hp.stdin.setRawMode ?? null, callable => callable.call(hp.stdin, false)); hp.stdin.pause(); },
  config,
  account: session.account,
  setId: true,
  kernelMode: requestedKernel,
  teto: tetoProvider,
};
if (session.command && !hp.stdin.isTTY) {
  throw new Error("local login mode requires a terminal");
}
if (!noRoot) {
  const base = new URL("../../.thistle.base/", import.meta.url);
  host.tree = new DirTree(requireValue(root ?? null, "src/main/cli.ts:68"), base, di < 0 && !(withValue(hp.env ?? null, value => (value.MIKUOS_ROOT ?? null)) ?? null) && !(withValue(hp.env ?? null, value => (value.THISTLE_ROOT ?? null)) ?? null));
  host.requireTree = true;
}
const os = boot(host, null);

const resize = (): void => os.resize(hp.stdout.rows ?? 24, hp.stdout.columns ?? 80);
resize();
withValue(hp.stdout.on ?? null, callable => callable.call(hp.stdout, "resize", resize));
await os.hello();

const wi = hp.argv.findIndex(x => x === "--wasm" || x === "--bin");
if (wi >= 0) {
  const src = (hp.argv[wi + 1] ?? null);
  ensure(src, () => { throw new Error(`${(hp.argv[wi] ?? null)} needs a host file path`); });
  const x = bh ? new Uint8Array(await bh.file(src).arrayBuffer()) : await (await hostModule("node:fs/promises")).readFile(src);
  const wasm = WebAssembly.validate(Uint8Array.from(x) as BufferSource);
  ensure(!((hp.argv[wi] ?? null) === "--wasm" ? !wasm : !wasm && !isExe(x)), () => { throw new Error(`${src} is not a supported guest binary`); });
  const name = hp.argv[wi + 2] ?? (src.split(/[\\/]/).at(-1) ?? null) ?? "guest.bin";
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
    for (const line of a) chain = chain.then(async () => { if (live) hp.exitCode = await os.run(line); }, null);
  });
  hp.stdin.on("end", () => { if (buf && live) chain = chain.then(async () => { hp.exitCode = await os.run(buf); }, null); });
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
    }, null).catch(<T>(caughtValue: T) => { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
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
    halt: () => withValue(host.halt ?? null, callable => callable.call(host)),
    complete: line => os.complete(line),
  });
  hp.stdin.setEncoding("utf8");
  withValue(hp.stdin.setRawMode ?? null, callable => callable.call(hp.stdin, true));
  hp.stdin.on("data", value => editor.key(typeof value === "string" ? value : String(value ?? "")));
  hp.on("SIGINT", () => editor.key("\x03"));
  hp.on("exit", () => withValue(hp.stdin.setRawMode ?? null, callable => callable.call(hp.stdin, false)));
  hp.stdin.resume();

  // Local session startup follows the selected interactive or piped-input mode.
  //@cg-expect-warning
  if (session.command) {
    chain = superviseLocalLogin(session, {
      live: () => live,
      run: command => os.run(command, [], false),
      unavailable: () => {
        hp.stderr.write("Local login mode requires an installed /bin/login.\r\n");
        withValue(host.halt ?? null, callable => callable.call(host));
      },
    }).catch(<T>(caughtValue: T) => { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      sessionStarting = false;
      hp.stderr.write(`${error instanceof Error ? error.message : String(error)}\r\n`);
      withValue(host.halt ?? null, callable => callable.call(host));
     });
  } else {
    sessionStarting = false;
    editor.render();
  }
}
