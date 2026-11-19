import { ensure } from "../core/err.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { App } from "./base.js";
import type { Sys } from "../core/sys.js";
import { bad } from "../core/err.js";
import { dec } from "../io/stream.js";
import { size } from "./util.js";
import { Shell, ShExit } from "../sh/shell.js";
import { LineEditor } from "../sh/editor.js";
import type { Tty } from "../io/tty.js";
import { Exe, codec, isExe, isObj } from "../asm/fmt.js";

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class TrueApp extends App {
  constructor() { super("true", "Return a successful exit status."); }
  override async run(): Promise<number> { return 0; }
}

export class FalseApp extends App {
  constructor() { super("false", "Return an unsuccessful exit status."); }
  override async run(): Promise<number> { return 1; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Env extends App {
  constructor() { super("env", "Print an environment or run with modified values.", "env [NAME=value ...] [command [arg ...]]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const e = s.env(null) as Map<string, string>;
    while ((withValue((a[0] ?? null) ?? null, value => value.includes("=")) ?? null)) { const x = requireValue(a.shift() ?? null, "src/apps/sys.ts:25"); const i = x.indexOf("="); e.set(x.slice(0, i), x.slice(i + 1)); }
    if (a.length) { const p = s.start(requireValue(a[0] ?? null, "src/apps/sys.ts:26"), a.slice(1), {"io": null, "fds": null, "pgid": null, "cwd": null,  env: e }); return s.wait(p.pid); }
    for (const [k, v] of [...e].sort()) await s.out(`${k}=${v}\n`);
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class PrintEnv extends App {
  constructor() { super("printenv", "Print environment values.", "printenv [NAME ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> { if (!a.length) return new Env().run(s, []); let n = 0; for (const k of a) { const v = s.env(k); if (v === null) n = 1; else await s.out(`${v}\n`); } return n; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Id extends App {
  constructor() { super("id", "Print process identity."); }
  override async run(s: Sys): Promise<number> {
    const name = (id: number, group = false): string => id === 0 ? "root" : id === 1000 ? (group ? "users" : "guest") : String(id);
    const euid = s.euid !== s.uid ? ` euid=${s.euid}(${name(s.euid)})` : "";
    const egid = s.egid !== s.gid ? ` egid=${s.egid}(${name(s.egid, true)})` : "";
    await s.out(`uid=${s.uid}(${name(s.uid)})${euid} gid=${s.gid}(${name(s.gid, true)})${egid} groups=${s.groups.join(",")}\n`);
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Whoami extends App {
  constructor() { super("whoami", "Print the effective user name."); }
  override async run(s: Sys): Promise<number> { await s.out(`${s.euid === 0 ? "root" : s.euid === 1000 ? "guest" : s.euid}\n`); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Uname extends App {
  constructor() { super("uname", "Print kernel information.", "uname [-asrnm]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a.join("");
    const all = f.includes("a"), q: string[] = [];
    if (!f || all || f.includes("s")) q.push(s.k.name);
    if (all || f.includes("n")) q.push(s.k.host);
    if (all || f.includes("r")) q.push(s.k.release);
    if (all || f.includes("m")) q.push("thistle64");
    await s.out(q.join(" ") + "\n"); return 0;
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class DateApp extends App {
  constructor() { super("date", "Print the current date and time.", "date [-u] [+format]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const d = new Date(), utc = a.includes("-u"), f = (a.find(x => x.startsWith("+")) ?? null);
    if (!f) { await s.out((utc ? d.toUTCString() : d.toString()) + "\n"); return 0; }
    const g = (k: string): number => utc ? requireValue(({ Y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), S: d.getUTCSeconds() } as Record<string, number>)[k] ?? null, "src/apps/sys.ts:73") : requireValue(({ Y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), H: d.getHours(), M: d.getMinutes(), S: d.getSeconds() } as Record<string, number>)[k] ?? null, "src/apps/sys.ts:73");
    await s.out(f.slice(1).replace(/%([YmdHMSs%])/g, (_m, k: string) => k === "%" ? "%" : k === "s" ? String(Math.floor(d.getTime() / 1000)) : k === "Y" ? String(g(k)) : pad(g(k))) + "\n"); return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Uptime extends App {
  constructor() { super("uptime", "Show time since kernel boot."); }
  override async run(s: Sys): Promise<number> { const n = Math.floor(s.uptime() / 1000); await s.out(`up ${Math.floor(n / 3600)}:${pad(Math.floor(n / 60) % 60)}:${pad(n % 60)}, ${s.ps().length} processes\n`); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Hostname extends App {
  constructor() { super("hostname", "Get or set the kernel host name.", "hostname [name]"); }
  override async run(s: Sys, a: string[]): Promise<number> { if ((a[0] ?? null)) { ensure(!(s.euid), () => bad("EPERM", "hostname")); s.k.host = requireValue(a[0] ?? null, "hostname"); s.setenv("HOSTNAME", (requireValue(a[0] ?? null, "src/apps/sys.ts:87") ?? null)); } else await s.out(s.k.host + "\n"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Dmesg extends App {
  constructor() { super("dmesg", "Print the kernel ring buffer."); }
  override async run(s: Sys): Promise<number> { await s.out(s.logs().join("\n") + "\n"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Free extends App {
  constructor() { super("free", "Show virtual kernel memory use.", "free [-h]"); }
  override async run(s: Sys, a: string[]): Promise<number> { const h = a.includes("-h"), total = s.k.fs.cap, used = s.k.fs.used(), f = (n: number) => h ? size(n) : String(n); await s.out("              total        used        free\n"); await s.out(`Mem:   ${f(total).padStart(12)}${f(used).padStart(12)}${f(total - used).padStart(12)}\n`); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Df extends App {
  constructor() { super("df", "Show virtual filesystem space.", "df [-h]"); }
  override async run(s: Sys, a: string[]): Promise<number> { const h = a.includes("-h"), t = s.k.fs.cap, u = s.k.fs.used(), f = (n: number) => h ? size(n) : String(Math.ceil(n / 1024)), d = s.k.disk ? "hostfs" : "memfs"; await s.out("Filesystem      Size      Used     Avail Use% Mounted on\n"); await s.out(`${d.padEnd(10)}${f(t).padStart(10)}${f(u).padStart(10)}${f(t - u).padStart(10)} ${String(Math.round(u / t * 100)).padStart(3)}% /\n`); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Mount extends App {
  constructor() { super("mount", "Show mounted kernel filesystems."); }
  override async run(s: Sys): Promise<number> { await s.out(s.k.mounts().map(x => `${x.src} on ${x.at} type ${x.kind} (${x.opt})`).join("\n") + "\n"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Clear extends App {
  constructor() { super("clear", "Clear the terminal."); }
  override async run(s: Sys): Promise<number> { await s.out("\x1b[3J\x1b[2J\x1b[H"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Which extends App {
  constructor() { super("which", "Locate commands in PATH.", "which command ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { let n = 0; for (const x of a) { try { await s.out(s.which(x) + "\n"); } catch { n = 1; } } return n; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Help extends App {
  constructor() { super("help", "List installed programs or describe one.", "help [command]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    // Shell input is consumed in the selected script or interactive-session mode.
    //@cg-expect-warning
    if ((a[0] ?? null)) { const x = (s.apps().find(v => v.name === (a[0] ?? null)) ?? null); if (!x) return 1; await s.out(`${x.name}: ${x.desc}\nusage: ${x.use}\n`); return 0; }
    await s.out("mikuOS userland commands:\n\n");
    const q = s.apps();
    for (let i = 0; i < q.length; i += 3) await s.out(q.slice(i, i + 3).map(x => x.name.padEnd(12)).join("") + "\n");
    await s.out("\nShell built-ins: : command cd export unset set alias unalias history jobs fg wait umask exit reboot\nUse 'help name' or 'name --help' for details. Try 'hello.wasm'.\n");
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class FileApp extends App {
  constructor() { super("file", "Identify executable and data formats.", "file path ..."); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    for (const p of a) {
      const st = s.stat(p, false); let k: string = st.kind;
      if (st.kind === "file") { const b = s.readb(p); const x = dec(b.slice(0, 80)); switch (true) {
case !!((b[0] ?? null) === 0 && (b[1] ?? null) === 0x61 && (b[2] ?? null) === 0x73 && (b[3] ?? null) === 0x6d): { k = "WebAssembly binary module";
break; }
case !!(isExe(b) || isObj(b)): {  const q = codec.unpack(b); k = `Thistle ${q.machine}${q instanceof Exe ? ` ${q.isa}` : ""} ${isExe(b) ? "native executable" : "relocatable object"}`;
break; }
default: { k = x.startsWith("#!") ? `script, ${(x.split("\n")[0] ?? null)}` : b.every(v => v === 9 || v === 10 || v === 13 || v >= 32 && v < 127) ? "UTF-8 text" : "data"; }
} }
      await s.out(`${p}: ${k}\n`);
    }
    return a.length ? 0 : 1;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Wasm extends App {
  constructor() { super("wasm", "Execute a WebAssembly/WASI binary.", "wasm path [arg ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> { const bin = a[0] ?? bad("EINVAL", "wasm: binary required"); const p = s.start(bin, a.slice(1)); return s.wait(p.pid); }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Thsh extends App {
  constructor(name = "thsh") { super(name, "Run the Thistle command shell.", `${name} [-c command] [script [arg ...]]`); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    const sh = new Shell(s);
    try {
      if ((a[0] ?? null) === "-c") return sh.run(a.slice(1).join(" "), false);
      if ((a[0] ?? null)) {
        const p = requireValue(a.shift() ?? null, "src/apps/sys.ts:154");
        s.setenv("0", p); s.setenv("#", String(a.length)); s.setenv("*", a.join(" ")); a.forEach((x, i) => s.setenv(String(i + 1), x));
        const q = s.read(p).split("\n");
        ((withValue((q[0] ?? null) ?? null, value => value.startsWith("#!")) ?? null)) && (q.shift() ?? null);
        return sh.run(q.join("\n"), false);
      }
      sh.ensureUserState(true);

      const tty = withValue((
        withValue((s.p.fds.get(0) ?? null) ?? null, value => value.input) as { tty: Tty | null } | null
      ) ?? null, value => value.tty);

      /*
       * A login shell launched by su(1) runs inside the guest process, so it
       * cannot use the host's outer editor. Reuse the normal LineEditor here
       * to retain the target account's history, suggestions, completion and
       * editing key bindings. Redirected stdin keeps the canonical fallback.
       */
      if (!tty) {
        for (;;) {
          await s.out(sh.prompt());
          const input = await s.chunkb();
          // Shell input is consumed in the selected script or interactive-session mode.
          //@cg-expect-warning
          if (!input.length) return sh.last;
          await sh.run(dec(input).replace(/\r?\n$/, ""));
        }
      }

      const inherited = tty.termios();
      const commands: Array<{
        source: string;
        bodies: readonly string[];
      }> = [];
      let logout = false;

      const editor = new LineEditor({
        shell: sh,
        prompt: () => sh.prompt(),
        busy: () => false,
        write: text => tty.write(text),
        execute: (source, bodies) => {
          commands.push({
            source,
            bodies: [...bodies],
          });
        },
        passthrough: data => tty.feed(data),
        halt: () => {
          logout = true;
        },
        complete: line => sh.complete(line),
      });

      tty.lineEditorMode(inherited);

      try {
        editor.render();

        while (!logout) {
          const input = await s.chunk();
          if (!input) return sh.last;

          editor.key(input);

          while (commands.length) {
            const command = requireValue(commands.shift() ?? null, "src/apps/sys.ts:218");

            /*
             * Child programmes receive the ordinary inherited terminal
             * rather than the shell editor's raw terminal mode.
             */
            tty.setTermios(inherited, false);

            await sh.run(
              command.source,
              true,
              command.bodies,
            );

            tty.lineEditorMode(inherited);
            editor.afterCommand(commands.length === 0);
          }
        }

        return sh.last;
      } finally {
        tty.setTermios(inherited, false);
      }
    } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (e instanceof ShExit) return e.code; throw e; }
  }
}

const truth = (s: Sys, a: string[]): boolean => {
  if (!a.length) return false;
  if ((a[0] ?? null) === "!") return !truth(s, a.slice(1));
  if (a.length === 1) return !!(a[0] ?? null);
  if ((a[0] ?? null) === "-e") { try { s.stat(requireValue(a[1] ?? null, "src/apps/sys.ts:249")); return true; } catch { return false; } }
  if ((a[0] ?? null) === "-f" || (a[0] ?? null) === "-d") { try { return s.stat(requireValue(a[1] ?? null, "src/apps/sys.ts:250")).kind === ((a[0] ?? null) === "-f" ? "file" : "dir"); } catch { return false; } }
  if ((a[0] ?? null) === "-r" || (a[0] ?? null) === "-w" || (a[0] ?? null) === "-x") { try { const m = s.stat(requireValue(a[1] ?? null, "src/apps/sys.ts:251")).mode; return !!(m & ((a[0] ?? null) === "-r" ? 0o444 : (a[0] ?? null) === "-w" ? 0o222 : 0o111)); } catch { return false; } }
  if (a.length === 2 && ((a[0] ?? null) === "-n" || (a[0] ?? null) === "-z")) return (a[0] ?? null) === "-n" ? !!(a[1] ?? null) : !(a[1] ?? null);
  if (["=", "==", "!="].includes(a[1] ?? "")) return (a[1] ?? null) === "!=" ? (a[0] ?? null) !== (a[2] ?? null) : (a[0] ?? null) === (a[2] ?? null);
  if (["-eq", "-ne", "-lt", "-le", "-gt", "-ge"].includes(a[1] ?? "")) { const x = Number((a[0] ?? null)), y = Number((a[2] ?? null)); return (a[1] ?? null) === "-eq" ? x === y : (a[1] ?? null) === "-ne" ? x !== y : (a[1] ?? null) === "-lt" ? x < y : (a[1] ?? null) === "-le" ? x <= y : (a[1] ?? null) === "-gt" ? x > y : x >= y; }
  return false;
};

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class TestApp extends App {
  constructor(name = "test") { super(name, "Evaluate file, string and integer expressions.", `${name} expression`); }
  override async run(s: Sys, a: string[]): Promise<number> { if (this.name === "[" && (a.at(-1) ?? null) === "]") a.pop(); return truth(s, a) ? 0 : 1; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Expr extends App {
  constructor() { super("expr", "Evaluate a simple integer or string expression.", "expr value operator value"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (a.length === 1) { await s.out((a[0] ?? null) + "\n"); return (a[0] ?? null) === "0" || !(a[0] ?? null) ? 1 : 0; }
    if (a.length !== 3) bad("EINVAL", "expr: three terms required");
    const [x, op, y] = a as [string, string, string]; let z: string | number;
    if (["+", "-", "*", "/", "%"].includes(op)) { const l = Number(x), r = Number(y); ensure(!(!Number.isFinite(l) || !Number.isFinite(r) || ((op === "/" || op === "%") && !r)), () => bad("EINVAL", "arithmetic")); z = op === "+" ? l + r : op === "-" ? l - r : op === "*" ? l * r : op === "/" ? Math.trunc(l / r) : l % r; }
    else z = op === "=" || op === "==" ? Number(x === y) : op === "!=" ? Number(x !== y) : op === ">" ? Number(x > y) : op === "<" ? Number(x < y) : bad("EINVAL", op);
    await s.out(`${z}\n`); return Number(z) === 0 ? 1 : 0;
  }
}
