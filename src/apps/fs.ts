import { ensure } from "../core/err.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { App } from "./base.js";
import type { Sys } from "../core/sys.js";
import { fmtMode, norm, Reg, Sym } from "../fs/vfs.js";
import type { VNode } from "../fs/vfs.js";
import { cols, globRx, size } from "./util.js";
import { bad, KErr } from "../core/err.js";

const base = (p: string): string => norm(p).split("/").filter(Boolean).at(-1) ?? "/";
const join = (a: string, b: string): string => a === "/" ? `/${b}` : `${a.replace(/\/$/, "")}/${b}`;

export class Pwd extends App {
  constructor() { super("pwd", "Print the current working directory."); }
  override async run(s: Sys): Promise<number> { await s.out(s.cwd + "\n"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Ls extends App {
  constructor() { super("ls", "List directory contents.", "ls [-alhR] [path ...]"); }

  override async run(s: Sys, a: string[]): Promise<number> {
    const fl = a.filter(x => /^-[^-]/.test(x)).join("");
    const all = fl.includes("a"), long = fl.includes("l"), hum = fl.includes("h"), rec = fl.includes("R");
    const ps = a.filter(x => !x.startsWith("-"));
    if (!ps.length) ps.push(".");
    const one = async (p: string, head: boolean): Promise<void> => {
      const st = s.stat(p, false);
      if (st.kind !== "dir") { await s.out(this.row(s, base(p), s.node(p, false), long, hum)); return; }
      if (head) await s.out(`${p}:\n`);
      let q = s.list(p);
      if (!all) q = q.filter(([n]) => !n.startsWith("."));
      if (long) for (const [n, v] of q) await s.out(this.row(s, n, v, true, hum));
      else await s.out(cols(q.map(([n]) => n)));
      // Stream and traversal modes select the applicable I/O checks and exit paths.
      //@cg-expect-warning
      if (rec) for (const [n, v] of q) if (v.kind === "dir" && n !== "." && n !== "..") { await s.out("\n"); await one(join(norm(p, s.cwd), n), true); }
    };
    for (let i = 0; i < ps.length; i++) { await one(requireValue(ps[i] ?? null, "src/apps/fs.ts:34"), ps.length > 1); if (i < ps.length - 1) await s.out("\n"); }
    return 0;
  }

  private row(s: Sys, n: string, v: VNode, long: boolean, hum: boolean): string {
    if (!long) return n + "\n";
    const z = v instanceof Reg ? v.size : v instanceof Sym ? v.to.length : 0;
    const d = new Date(v.mt).toISOString().slice(0, 16).replace("T", " ");
    const tail = v instanceof Sym ? ` -> ${v.to}` : "";
    return `${fmtMode(v)} ${String(v.nlink).padStart(2)} ${String(v.uid).padStart(4)} ${String(v.gid).padStart(4)} ${(hum ? size(z) : String(z)).padStart(7)} ${d} ${n}${tail}\n`;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Cat extends App {
  constructor() { super("cat", "Concatenate files to standard output.", "cat [-n] [file ...]"); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    const num = a.includes("-n");
    const ps = a.filter(x => x !== "-n");
    let n = 1;
    const put = async (x: string): Promise<void> => {
      if (!num) { await s.out(x); return; }
      const lines = withValue(x.match(/.*(?:\n|$)/g) ?? null, value => value.filter(Boolean)) ?? [];
      for (const line of lines) await s.out(`${String(n++).padStart(6)}\t${line}`);
    };
    if (!ps.length) await put(await s.input());
    else for (const p of ps) {
      // Stream and traversal modes select the applicable I/O checks and exit paths.
      //@cg-expect-warning
      if (p === "-") { await put(await s.input()); continue; }
      // Stream and traversal modes select the applicable I/O checks and exit paths.
      //@cg-expect-warning
      if (num) { await put(s.read(p)); continue; }
      const fd = s.open(p);
      // Stream and traversal modes select the applicable I/O checks and exit paths.
      //@cg-expect-warning
      try { for (;;) { s.chk(); const b = s.fdr(fd, 65536); if (!b.length) break; await s.out(b); } }
      finally { s.close(fd); }
    }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Touch extends App {
  constructor() { super("touch", "Create files or update their modification time.", "touch file ..."); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length) bad("EINVAL", "touch: missing file");
    for (const p of a) { try { s.writeb(p, s.readb(p)); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (e instanceof KErr && e.code === "ENOENT") s.write(p, ""); else throw e; } }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Mkdir extends App {
  constructor() { super("mkdir", "Create directories.", "mkdir [-p] [-m mode] dir ..."); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    const p = a.includes("-p");
    const mi = a.indexOf("-m");
    const mode = mi >= 0 ? Number.parseInt(a[mi + 1] ?? "", 8) : 0o777;
    const ps = a.filter((x, i) => x !== "-p" && x !== "-m" && !(mi >= 0 && i === mi + 1));
    if (!ps.length || !Number.isFinite(mode)) bad("EINVAL", "mkdir arguments");
    for (const x of ps) {
      if (!p) s.mkdir(x, mode);
      else {
        let q = "";
        // Stream and traversal modes select the applicable I/O checks and exit paths.
        //@cg-expect-warning
        for (const v of norm(x, s.cwd).split("/").filter(Boolean)) { q += `/${v}`; try { s.mkdir(q, mode); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (!(e instanceof KErr) || e.code !== "EEXIST") throw e; } }
      }
    }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Rmdir extends App {
  constructor() { super("rmdir", "Remove empty directories.", "rmdir dir ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { if (!a.length) bad("EINVAL", "rmdir: missing directory"); for (const p of a) s.rm(p, true); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Rm extends App {
  constructor() { super("rm", "Remove files or directory trees.", "rm [-rf] path ..."); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    const rec = a.some(x => /^-.*r/.test(x)), force = a.some(x => /^-.*f/.test(x));
    const ps = a.filter(x => !x.startsWith("-"));
    if (!ps.length) bad("EINVAL", "rm: missing path");
    const go = (p: string): void => {
      try {
        if (s.stat(p, false).kind === "dir") {
          ensure(rec, () => bad("EISDIR", p));
          for (const [n] of s.list(p)) go(join(norm(p, s.cwd), n));
          s.rm(p, true);
        } else s.rm(p);
      } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (!force) throw e; }
    };
    for (const p of ps) go(p);
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Cp extends App {
  constructor() { super("cp", "Copy files and directory trees.", "cp [-r] source ... dest"); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    const rec = a.includes("-r") || a.includes("-R");
    const q = a.filter(x => x !== "-r" && x !== "-R");
    if (q.length < 2) bad("EINVAL", "cp: source and destination required");
    const dst = requireValue(q.pop() ?? null, "src/apps/fs.ts:129");
    const many = q.length > 1;
    if (many && s.stat(dst).kind !== "dir") bad("ENOTDIR", dst);
    const go = (a0: string, b0: string): void => {
      const st = s.stat(a0, false);
      switch (true) {
case !!(st.kind === "dir"): {
        if (!rec) bad("EISDIR", a0);
        try { s.mkdir(b0, st.mode); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (!(e instanceof KErr) || e.code !== "EEXIST") throw e; }
        for (const [n] of s.list(a0)) go(join(norm(a0, s.cwd), n), join(norm(b0, s.cwd), n));

break; }
case !!(st.kind === "link"): { s.symlink(s.readlink(a0), b0);
break; }
default: {  s.writeb(b0, s.readb(a0)); s.chmod(b0, st.mode);  }
}
    };
    for (const x of q) { let to = dst; try { if (s.stat(dst).kind === "dir") to = join(norm(dst, s.cwd), base(x)); } catch { if (many) throw new KErr("ENOENT", dst); } go(x, to); }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Mv extends App {
  constructor() { super("mv", "Move or rename files.", "mv source ... dest"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (a.length < 2) bad("EINVAL", "mv: source and destination required");
    const dst = requireValue(a.pop() ?? null, "src/apps/fs.ts:150");
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
    for (const p of a) { let q = dst; try { if (s.stat(dst).kind === "dir") q = join(norm(dst, s.cwd), base(p)); } catch { /* plain rename */ } s.mv(p, q); }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Ln extends App {
  constructor() { super("ln", "Create hard or symbolic links.", "ln [-s] target link"); }
  override async run(s: Sys, a: string[]): Promise<number> { const sym = (a[0] ?? null) === "-s"; if (sym) a.shift(); if (a.length !== 2) bad("EINVAL", "ln: target and link required"); sym ? s.symlink(requireValue(a[0] ?? null, "src/apps/fs.ts:158"), requireValue(a[1] ?? null, "src/apps/fs.ts:158")) : s.link(requireValue(a[0] ?? null, "src/apps/fs.ts:158"), requireValue(a[1] ?? null, "src/apps/fs.ts:158")); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Readlink extends App {
  constructor() { super("readlink", "Print symbolic-link targets.", "readlink link ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { for (const p of a) await s.out(s.readlink(p) + "\n"); return a.length ? 0 : 1; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class StatApp extends App {
  constructor() { super("stat", "Display inode metadata.", "stat path ..."); }
  override async run(s: Sys, a: string[]): Promise<number> {
    for (const p of a) { const z = s.stat(p, false); await s.out(`  File: ${p}\n  Size: ${z.size}\tType: ${z.kind}\nDevice: memfs\tInode: ${z.ino}\tLinks: ${z.nlink}\nAccess: (${z.mode.toString(8).padStart(4, "0")})\tUid: ${z.uid}\tGid: ${z.gid}\nModify: ${new Date(z.mt).toISOString()}\nChange: ${new Date(z.ct).toISOString()}\n`); }
    return a.length ? 0 : 1;
  }
}

const symMode = (old: number, x: string): number => {
  const m = /^([ugoa]*)([+=-])([rwx]+)$/.exec(x);
  if (!m) return bad("EINVAL", `mode ${x}`);
  const who = (m[1] ?? null) || "a";
  let bits = 0;
  for (const w of who.includes("a") ? "ugo" : who) {
    const sh = w === "u" ? 6 : w === "g" ? 3 : 0;
    for (const c of requireValue(m[3] ?? null, "src/apps/fs.ts:181")) bits |= (c === "r" ? 4 : c === "w" ? 2 : 1) << sh;
  }
  return (m[2] ?? null) === "+" ? old | bits : (m[2] ?? null) === "-" ? old & ~bits : (old & ~(who.includes("u") || who.includes("a") ? 0o700 : 0) & ~(who.includes("g") || who.includes("a") ? 0o070 : 0) & ~(who.includes("o") || who.includes("a") ? 0o007 : 0)) | bits;
};

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Chmod extends App {
  constructor() { super("chmod", "Change file mode bits.", "chmod mode path ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { if (a.length < 2) bad("EINVAL", "chmod arguments"); const m = requireValue(a.shift() ?? null, "src/apps/fs.ts:188"); for (const p of a) s.chmod(p, /^[0-7]+$/.test(m) ? Number.parseInt(m, 8) : symMode(s.stat(p, false).mode, m)); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Chown extends App {
  constructor() { super("chown", "Change file owner and group.", "chown uid[:gid] path ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { if (a.length < 2) bad("EINVAL", "chown arguments"); const [u = "", g = null] = requireValue(a.shift() ?? null, "src/apps/fs.ts:193").split(":"); const uid = Number(u), gid = g === null ? uid : Number(g); if (!Number.isInteger(uid) || !Number.isInteger(gid)) bad("EINVAL", "numeric ids required"); for (const p of a) s.chown(p, uid, gid); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Find extends App {
  constructor() { super("find", "Walk a directory tree.", "find [path] [-name glob] [-type f|d|l]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const root = (a[0] ?? null) && !requireValue((a[0] ?? null) ?? null, "src/apps/fs.ts:201").startsWith("-") ? requireValue(a.shift() ?? null, "src/apps/fs.ts:199") : ".";
    const ni = a.indexOf("-name"), ti = a.indexOf("-type");
    const rx = ni >= 0 ? globRx(a[ni + 1] ?? "") : null;
    const ty = ti >= 0 ? (a[ti + 1] ?? null) : null;
    for (const p of s.paths(root)) {
      const st = s.stat(p, false);
      const k = st.kind === "file" ? "f" : st.kind === "dir" ? "d" : st.kind === "link" ? "l" : "c";
      if ((!rx || rx.test(base(p))) && (!ty || ty === k)) await s.out((root.startsWith("/") ? p : p === norm(root, s.cwd) ? root : `.${p.slice(s.cwd.length)}`) + "\n");
    }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class BaseName extends App {
  constructor() { super("basename", "Strip directory components.", "basename path"); }
  override async run(s: Sys, a: string[]): Promise<number> { const p = a[0] ?? bad("EINVAL", "path required"); await s.out(base(p) + "\n"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class DirName extends App {
  constructor() { super("dirname", "Strip the final path component.", "dirname path"); }
  override async run(s: Sys, a: string[]): Promise<number> { const x = a[0] ?? bad("EINVAL", "path required"); const p = x.replace(/\/+$/, ""); await s.out((p.slice(0, p.lastIndexOf("/")) || (p.startsWith("/") ? "/" : ".")) + "\n"); return 0; }
}
