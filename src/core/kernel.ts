// This module composes kernel, toolchain or integration-test boundaries and intentionally imports their contracts.
//@cg-expect-warning
import { ensure } from "./err.js";
import { withValue } from "./err.js";
import { requireValue } from "./err.js";
import { App } from "../apps/base.js";
import { bad, KErr, msg } from "./err.js";
import { MemIn, MemOut, enc } from "../io/stream.js";
import type { In, Out } from "../io/stream.js";
import { Reg, Vfs } from "../fs/vfs.js";
import { credGid, credUid } from "../fs/vfs.js";
import type { Cred } from "../fs/vfs.js";
import { ExecReplace, Fd, Proc } from "./proc.js";
import type { Io, Sig } from "./proc.js";
import { Sys } from "./sys.js";
import { Wasi } from "../wasm/wasi.js";
import { Sched } from "./sched.js";
import { Net } from "../net/net.js";
import type { TetoImageProvider } from "../teto/loader.js";
import { Exe, codec, isExe } from "../asm/fmt.js";
import { Vm } from "../vm/vm.js";
import { Vm64 } from "../vm/vm64.js";
import { Rv64 } from "../vm/rv64.js";
import { Lim } from "./cap.js";
import { DEFAULT_CONFIG, rootCred } from "./config.js";
import type { AccountConfig, SystemConfig } from "./config.js";

export interface Start {
  io: Partial<Io> | null;
  fds: Map<number, Fd> | null;
  pgid: number | null;
  cwd: string | null;
  env: Map<string, string> | null;
}

export interface PInfo {
  pid: number;
  ppid: number;
  pgid: number;
  uid: number;
  state: string;
  ms: number;
  cmd: string;
}

export interface Mnt { src: string; at: string; kind: string; opt: string; }

const root: Cred = rootCred();

const fullCred = (cred: Cred): Cred => {
  const uid = cred.euid ?? cred.uid ?? cred.ruid ?? 0;
  const gid = cred.egid ?? cred.gid ?? cred.rgid ?? 0;
  const ruid = cred.ruid ?? cred.uid ?? uid;
  const rgid = cred.rgid ?? cred.gid ?? gid;
  return {
    uid,
    gid,
    ruid,
    euid: uid,
    suid: cred.suid ?? uid,
    rgid,
    egid: gid,
    sgid: cred.sgid ?? gid,
    groups: [...cred.groups],
  };
};

const accountCred = (account: AccountConfig | Cred): { cred: Cred; name: string; home: string } => {
  if ("cred" in account) {
    return {
      cred: fullCred(account.cred),
      name: account.name,
      home: account.home,
    };
  }
  const cred = fullCred(account);
  return {
    cred,
    name: credUid(cred) === 0 ? "root" : "guest",
    home: credUid(cred) === 0 ? "/root" : "/home/guest",
  };
};

const procFsCred = (p: Proc): Cred => ({"ruid": null, "euid": null, "suid": null, "rgid": null, "egid": null, "sgid": null, uid: p.fsuid,
  gid: p.fsgid,
  groups: [...p.cred.groups],
});

export class Kern {
  readonly fs: Vfs;
  readonly apps = new Map<string, App>();
  readonly procs = new Map<number, Proc>();
  readonly logs: string[] = [];
  readonly sched = new Sched();
  readonly born = Date.now();
  name: string;
  readonly release: string;
  host = "thistle";
  executionCore = "Thistle TypeScript";
  disk = false;
  ttyFn: (s: string, err: boolean) => void = () => {};
  private seq = 1;
  private haltFn: (() => void) | null = null;

  // The public construction contract retains its positional arguments for existing callers.
  //@cg-expect-warning
  constructor(
    readonly net = new Net(),
    readonly lim = Lim.host(),
    readonly config: SystemConfig = DEFAULT_CONFIG,
    readonly setId = false,
    readonly teto: TetoImageProvider | null = null,
  ) {
    this.fs = new Vfs(lim.fs);
    this.name = config.kernel.name;
    this.release = config.kernel.version;
    this.host = config.hostName;
    net.log = s => this.log(s);
  }

  setHalt(fn: () => void): void { this.haltFn = fn; }
  tty(s: string, err = false): void { this.ttyFn(s, err); }

  log(s: string): void {
    const t = ((Date.now() - this.born) / 1000).toFixed(3).padStart(8);
    this.logs.push(`[${t}] ${s}`);
  }

  init(): Proc {
    if (this.procs.has(1)) return requireValue(this.procs.get(1) ?? null, "src/core/kernel.ts:124");
    const z = new MemOut();
    const p = new Proc(1, 0, 1, "init", ["init"], "/", this.baseEnv(), root, { sin: new MemIn(), sout: z, serr: z });
    p.state = "sleep";
    this.procs.set(1, p);
    this.seq = 2;
    this.log("init: process 1 entered service loop");
    return p;
  }

  session(io: Io, account: AccountConfig | Cred = root): Proc {
    this.init();
    const { cred, name, home } = accountCred(account);
    const pid = this.seq++;
    const env = this.baseEnv();
    env.set("HOME", home);
    env.set("USER", name);
    env.set("PWD", home);
    const p = new Proc(pid, 1, pid, "thsh", ["thsh"], home, env, fullCred(cred), io);
    p.state = "run";
    this.procs.set(pid, p);
    requireValue(this.procs.get(1) ?? null, "src/core/kernel.ts:145").kids.add(pid);
    this.log(`tty: session pid=${pid} uid=${credUid(cred)}`);
    return p;
  }

  private baseEnv(): Map<string, string> {
    return new Map([
      ["PATH", "/bin:/usr/bin:/sbin:/usr/sbin"], ["HOME", "/root"], ["USER", "root"],
      ["SHELL", "/bin/thsh"], ["TERM", this.config.terminal.term], ["LANG", this.config.terminal.lang],
      ["HOSTNAME", this.host], ["PS1", "\\u@\\h:\\w\\$ "],
    ]);
  }

  reg(a: App): void { this.apps.set(a.name, a); }

  install(a: App): void {
    this.reg(a);
    const p = `/bin/${a.name}`;
    const c = root;
    try { this.fs.mkfile(p, `#!thistle:${a.name}\n`, "/", c, 0o755); }
    catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (!(e instanceof KErr) || e.code !== "EEXIST") throw e; }
  }

  which(name: string, p: Proc): string {
    if (name.includes("/")) {
      const c = procFsCred(p);
      const q = this.fs.at(name, p.cwd, c).path;
      this.fs.need(this.fs.at(q, "/", c).node, c, 1, q);
      return q;
    }
    for (const d of (p.env.get("PATH") ?? "/bin").split(":")) {
      const q = `${d.replace(/\/$/, "")}/${name}`;
      try {
        const c = procFsCred(p);
        const h = this.fs.at(q, p.cwd, c);
        this.fs.need(h.node, c, 1, q);
        if (h.node instanceof Reg) return h.path;
      // This documented best-effort fallback intentionally continues after the optional operation fails.
      //@cg-expect-warning
      } catch { /* PATH lookup is allowed to miss. Quite often, in fact. */ }
    }
    return bad("ENOENT", `${name}: command not found`);
  }

  private validateExecutable(path: string, bin: Uint8Array): void {
    if (bin.length >= 4 && (bin[0] ?? null) === 0 && (bin[1] ?? null) === 0x61 && (bin[2] ?? null) === 0x73 && (bin[3] ?? null) === 0x6d) return;

    if (isExe(bin)) {
      try {
        const image = codec.unpack(bin);
        // Executable selection preserves process identity and descriptor scope across replacement.
        //@cg-expect-warning
        if (!(image instanceof Exe)) bad("ENOEXEC", `${path}: not an executable`);
      } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
        bad("ENOEXEC", `${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

    const source = new TextDecoder().decode(bin);
    const app = /^#!thistle:([^\n]+)\n/.exec(source);

    if (app) {
      ensure(this.apps.has(requireValue(app[1] ?? null, "src/core/kernel.ts:204")), () => bad("ENOEXEC", `${path}: missing app ${(app[1] ?? null)}`));
      return;
    }

    if (source.startsWith("#!/bin/thsh\n") || source.startsWith("#!/bin/sh\n")) {
      ensure(this.apps.has("thsh"), () => bad("ENOEXEC", "shell is not installed"));
      return;
    }

    bad("ENOEXEC", `${path}: unknown executable format`);
  }

  private executableCred(path: string, node: Reg, base: Cred): Cred {
    let cred = fullCred(base);
    const mode = node.mode;
    const privileged = this.setId && !!(mode & 0o6000);

    if (!privileged) return cred;

    const text = new TextDecoder().decode(node.head(64));

    if (text.startsWith("#!")) {
      bad("EACCES", `${path}: set-ID scripts are not supported`);
    }

    if (mode & 0o4000) {
      cred = { ...cred, euid: node.uid, uid: node.uid, suid: node.uid };
    }

    if (mode & 0o2000) {
      cred = { ...cred, egid: node.gid, gid: node.gid, sgid: node.gid };
    }

    return cred;
  }

  start(name: string, argv: string[], par: Proc, opt: Start = {"io": null, "fds": null, "pgid": null, "cwd": null, "env": null}): Proc {
    const path = this.which(name, par);
    const h = this.fs.at(path, par.cwd, procFsCred(par));
    const node = h.node instanceof Reg ? h.node : bad("ENOEXEC", path);
    const pid = this.seq++;
    const io: Io = {
      sin: withValue(opt.io ?? null, value => (value.sin ?? null)) ?? withValue((par.fds.get(0) ?? null) ?? null, value => value.input) ?? new MemIn(),
      sout: withValue(opt.io ?? null, value => (value.sout ?? null)) ?? withValue((par.fds.get(1) ?? null) ?? null, value => value.output) ?? new MemOut(),
      serr: withValue(opt.io ?? null, value => (value.serr ?? null)) ?? withValue((par.fds.get(2) ?? null) ?? null, value => value.output) ?? new MemOut(),
    };
    if (!opt.fds) {
      withValue(io.sin.holdR ?? null, callable => callable.call(io.sin));
      withValue(io.sout.hold ?? null, callable => callable.call(io.sout));
      (io.serr !== io.sout) && (withValue(io.serr.hold ?? null, callable => callable.call(io.serr)));
    }
    const cred = this.executableCred(path, node, par.cred);
    const p = new Proc(
      pid, par.pid, opt.pgid ?? pid, path, [name, ...argv], opt.cwd ?? par.cwd,
      new Map(opt.env ?? par.env), cred, io,
    );
    if (opt.fds) {
      p.fds.clear(); p.allHeld = true;
      for (const [n, f] of opt.fds) {
        withValue(withValue(f.input ?? null, value => value.holdR) ?? null, callable => callable.call(f.input)); withValue(withValue(f.output ?? null, value => value.hold) ?? null, callable => callable.call(f.output));
        const q = new Fd(f.input, f.output, f.path, f.rd, f.wr, f.add, f.clo); q.pos = f.pos; p.fds.set(n, q);
      }
    }
    p.mask = par.mask;
    this.procs.set(pid, p);
    par.kids.add(pid);
    this.sched.add(p, async () => this.run(p, path, (await node.materialise()).slice(), argv));
    return p;
  }

  async exec(name: string, argv: string[], env: Map<string, string>, p: Proc): Promise<never> {
    const credential = procFsCred(p);
    const handle = this.fs.at(name, p.cwd, credential);

    this.fs.need(handle.node, credential, 1, handle.path);

    const node = handle.node instanceof Reg
      ? handle.node
      : bad("ENOEXEC", handle.path);

    const image = (await node.materialise()).slice();

    this.validateExecutable(handle.path, image);

    const fullArgv = argv.length
      ? [...argv]
      : [name];

    throw new ExecReplace(
      handle.path,
      image,
      fullArgv.slice(1),
      fullArgv,
      new Map(env),
      this.executableCred(handle.path, node, p.cred),
    );
  }

  // Executable selection preserves process identity and descriptor scope across replacement.
  private async run(p: Proc, path: string, bin: Uint8Array, argv: string[]): Promise<void> {
    p.state = "run";
    let code = 126;
    try {
      for (;;) {
        try {
          switch (true) {
case !!(bin.length >= 4 && (bin[0] ?? null) === 0 && (bin[1] ?? null) === 0x61 && (bin[2] ?? null) === 0x73 && (bin[3] ?? null) === 0x6d): {
        code = await new Wasi(new Sys(this, p)).run(bin, [path, ...argv]);

break; }
case !!(isExe(bin)): {
        let x: Exe;
        try { const q = codec.unpack(bin); x = q instanceof Exe ? q : bad("ENOEXEC", `${path}: not an executable`); }
        catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  x = bad("ENOEXEC", `${path}: ${e instanceof Error ? e.message : String(e)}`); }
        code = x.machine === "thistle64"
          ? x.isa === "rv64gc" ? await new Rv64(new Sys(this, p)).run(x, [path, ...argv], bin) : await new Vm64(new Sys(this, p)).run(x, [path, ...argv])
          : await new Vm(new Sys(this, p)).run(x, [path, ...argv]);

break; }
default: {
        const src = new TextDecoder().decode(bin);
        const m = /^#!thistle:([^\n]+)\n/.exec(src);
        switch (true) {
case !!(m): {
          const a = this.apps.get(requireValue(m[1] ?? null, "src/core/kernel.ts:321")) ?? bad("ENOEXEC", `${path}: missing app ${(m[1] ?? null)}`);
          const s = new Sys(this, p);
          code = argv.includes("--help") ? await a.help(s) : await a.run(s, argv);

break; }
case !!(src.startsWith("#!/bin/thsh\n") || src.startsWith("#!/bin/sh\n")): {
          const a = this.apps.get("thsh") ?? bad("ENOEXEC", "shell is not installed");
          code = await a.run(new Sys(this, p), [path, ...argv]);

break; }
default: { bad("ENOEXEC", `${path}: unknown executable format`); }
}
       }
}

          break;
        } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
          if (!(error instanceof ExecReplace)) throw error;

          for (const [fd, descriptor] of [...p.fds]) {
            if (!descriptor.clo) continue;

            withValue(withValue(descriptor.input ?? null, value => value.releaseR) ?? null, callable => callable.call(descriptor.input));
            withValue(withValue(descriptor.output ?? null, value => value.close) ?? null, callable => callable.call(descriptor.output));
            p.fds.delete(fd);
          }

          path = error.path;
          bin = error.image;
          argv = error.args;

          p.cmd = error.path;
          p.argv = [...error.argv];
          p.env = new Map(error.env);
          p.cred = fullCred(error.cred);
          p.fsuid = credUid(p.cred);
          p.fsgid = credGid(p.cred);

          this.log(`proc: pid=${p.pid} exec=${path}`);
        }
      }
    } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      switch (true) {
case !!(p.sig): { code = 128 + p.sig;
break; }
case !!(e instanceof KErr && e.code === "EPIPE"): { code = 141;
break; }
default: {
        code = e instanceof KErr ? e.code === "EINTR" ? 130 : e.code === "ENOEXEC" || e.code === "EACCES" ? 126 : e.code === "ENOENT" ? 127 : 1 : 1;
        await (withValue(withValue((p.fds.get(2) ?? null) ?? null, value => value.output) ?? null, value => value.wr(enc(`${(p.argv[0] ?? null)}: ${msg(e)}\n`))) ?? null);
       }
}
    } finally {
      if (p.allHeld) {
        for (const f of p.fds.values()) { withValue(withValue(f.input ?? null, value => value.releaseR) ?? null, callable => callable.call(f.input)); withValue(withValue(f.output ?? null, value => value.close) ?? null, callable => callable.call(f.output)); }
      } else {
        withValue(withValue(withValue((p.fds.get(0) ?? null) ?? null, value => value.input) ?? null, value => value.releaseR) ?? null, callable => callable.call(withValue((p.fds.get(0) ?? null) ?? null, value => value.input)));
        withValue(withValue(withValue((p.fds.get(1) ?? null) ?? null, value => value.output) ?? null, value => value.close) ?? null, callable => callable.call(withValue((p.fds.get(1) ?? null) ?? null, value => value.output)));
        (withValue((p.fds.get(2) ?? null) ?? null, value => value.output) !== withValue((p.fds.get(1) ?? null) ?? null, value => value.output)) && (withValue(withValue(withValue((p.fds.get(2) ?? null) ?? null, value => value.output) ?? null, value => value.close) ?? null, callable => callable.call(withValue((p.fds.get(2) ?? null) ?? null, value => value.output))));
      }
      p.end(code);
      this.log(`proc: pid=${p.pid} exit=${code} cmd=${path}`);
    }
  }

  async wait(pid: number, par: Proc): Promise<number> {
    const p = this.procs.get(pid) ?? bad("ESRCH", String(pid));
    if (p.ppid !== par.pid && (par.cred.euid ?? par.cred.uid ?? 0) !== 0) bad("ECHILD", String(pid));
    const n = await p.done;
    this.reap(pid, par);
    return n;
  }

  reap(pid: number, par: Proc | null = null): void {
    if (pid <= 2) return;
    const p = (this.procs.get(pid) ?? null);
    if (!p || p.code === null) return;
    this.procs.delete(pid);
    requireValue(withValue((par ?? (this.procs.get(p.ppid) ?? null)) ?? null, value => value.kids) ?? null, "src/core/kernel.ts:390").delete(pid);
  }

  kill(id: number, sig: Sig, by: Proc): number {
    const q = [...this.procs.values()].filter(p => id < 0 ? p.pgid === -id : p.pid === id);
    if (!q.length) bad("ESRCH", String(id));
    let n = 0;
    for (const p of q) {
      if (p.pid === 1) continue;
      if ((by.cred.euid ?? by.cred.uid ?? 0) !== 0 && (by.cred.ruid ?? by.cred.uid ?? 0) !== (p.cred.ruid ?? p.cred.uid ?? 0)) bad("EPERM", String(p.pid));
      if (sig !== 0) {
        p.signal(sig);
        (sig === 9 || p.state === "sleep") && (p.end(128 + sig));
      }
      n++;
    }
    this.log(`signal: sig=${sig} target=${id} sender=${by.pid}`);
    return n;
  }

  ps(): PInfo[] {
    return [...this.procs.values()].sort((a, b) => a.pid - b.pid).map(p => ({
      pid: p.pid, ppid: p.ppid, pgid: p.pgid, uid: p.cred.euid ?? p.cred.uid ?? 0,
      state: p.state, ms: p.ms(), cmd: p.argv.join(" "),
    }));
  }

  mounts(): Mnt[] {
    const a: Mnt[] = [
      { src: this.disk ? "hostfs" : "memfs", at: "/", kind: "thistlefs", opt: `rw,${this.setId ? "suid" : "nosuid"},relatime` },
      { src: "proc", at: "/proc", kind: "procfs", opt: "ro" },
      { src: "dev", at: "/dev", kind: "devfs", opt: "rw" },
    ];
    return a;
  }

  stop(by: Proc): void {
    if ((by.cred.euid ?? by.cred.uid ?? 0) !== 0) bad("EPERM", "reboot");
    for (const p of this.procs.values()) if (p.pid !== 1 && p.pid !== by.pid) p.signal(15);
    this.log("system: reboot requested");
    withValue(this.haltFn ?? null, callable => callable.call(this));
  }

  fd(p: Proc): number {
    for (let n = 3; n < 256; n++) if (!p.fds.has(n)) return n;
    return bad("EMFILE", "descriptor table full");
  }

  cloneFd(p: Proc, old: number, nu: number | null = null): number {
    const f = p.fds.get(old) ?? bad("EBADF", String(old));
    const n = nu ?? this.fd(p);
    if (n === old) return n;
    const q = (p.fds.get(n) ?? null);
    withValue(withValue(withValue(q ?? null, value => value.input) ?? null, value => value.releaseR) ?? null, callable => callable.call(withValue(q ?? null, value => value.input)));
    withValue(withValue(withValue(q ?? null, value => value.output) ?? null, value => value.close) ?? null, callable => callable.call(withValue(q ?? null, value => value.output)));
    withValue(withValue(f.input ?? null, value => value.holdR) ?? null, callable => callable.call(f.input));
    withValue(withValue(f.output ?? null, value => value.hold) ?? null, callable => callable.call(f.output));
    p.fds.set(n, new Fd(f.input, f.output, f.path, f.rd, f.wr, f.add));
    return n;
  }
}
