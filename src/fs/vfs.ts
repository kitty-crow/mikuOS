import { bad, KErr } from "../core/err.js";
import { dec, enc } from "../io/stream.js";

export interface Cred {
  uid: number;
  gid: number;
  groups: number[];
}

export type Kind = "file" | "dir" | "link" | "char";
export type Rfn = (n: number) => Uint8Array;
export type Wfn = (b: Uint8Array) => number;

let next = 1;

export abstract class VNode {
  readonly ino = next++;
  abstract readonly kind: Kind;
  nlink = 1;
  at = Date.now();
  mt = this.at;
  ct = this.at;

  protected constructor(
    public mode: number,
    public uid = 0,
    public gid = 0,
  ) {}

  touch(data = false): void {
    const t = Date.now();
    this.ct = t;
    if (data) this.mt = t;
  }
}

export class Reg extends VNode {
  readonly kind = "file" as const;
  data: Uint8Array;
  sum: string | undefined;

  constructor(data: Uint8Array | string = "", mode = 0o644, uid = 0, gid = 0) {
    super(mode, uid, gid);
    this.data = typeof data === "string" ? enc(data) : data.slice();
  }
}

export class Dir extends VNode {
  readonly kind = "dir" as const;
  readonly ent = new Map<string, VNode>();

  constructor(mode = 0o755, uid = 0, gid = 0) { super(mode, uid, gid); }
}

export class Sym extends VNode {
  readonly kind = "link" as const;

  constructor(public to: string, uid = 0, gid = 0) { super(0o777, uid, gid); }
}

export class Chr extends VNode {
  readonly kind = "char" as const;

  constructor(
    public readonly rfn: Rfn,
    public readonly wfn: Wfn,
    mode = 0o666,
    uid = 0,
    gid = 0,
    public readonly repeat = false,
  ) { super(mode, uid, gid); }
}

export interface St {
  ino: number;
  kind: Kind;
  mode: number;
  uid: number;
  gid: number;
  nlink: number;
  size: number;
  at: number;
  mt: number;
  ct: number;
}

export interface Hit {
  node: VNode;
  path: string;
}

const seg = (p: string): string[] => p.split("/").filter(x => x && x !== ".");
const wild = (p: string): boolean => /[*?]|\[[^\]]+\]/.test(p);

const wrx = (p: string): RegExp => {
  let s = "^";
  for (let i = 0; i < p.length; i++) {
    const c = p[i]!;
    if (c === "*") s += "[^/]*";
    else if (c === "?") s += "[^/]";
    else if (c === "[") {
      const z = p.indexOf("]", i + 1);
      if (z < 0) s += "\\[";
      else { const x = p.slice(i + 1, z); s += `[${x.startsWith("!") ? "^" + x.slice(1) : x}]`; i = z; }
    } else s += /[.+^${}()|\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(s + "$");
};

export const norm = (p: string, cwd = "/"): string => {
  const src = p.startsWith("/") ? seg(p) : [...seg(cwd), ...seg(p)];
  const out: string[] = [];
  for (const x of src) {
    if (x === "..") out.pop();
    else if (x !== ".") out.push(x);
  }
  return `/${out.join("/")}`;
};

export const fmtMode = (n: VNode): string => {
  const k = n.kind === "dir" ? "d" : n.kind === "link" ? "l" : n.kind === "char" ? "c" : "-";
  const bit = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  const ch = ["r", "w", "x", "r", "w", "x", "r", "w", "x"];
  return k + bit.map((b, i) => n.mode & b ? ch[i] : "-").join("");
};

export class Vfs {
  readonly root = new Dir();
  readonly cap: number;

  constructor(cap = 16 * 1024 * 1024) { this.cap = cap; }

  private ok(n: VNode, c: Cred, bit: number): boolean {
    if (c.uid === 0) return true;
    const sh = c.uid === n.uid ? 6 : c.gid === n.gid || c.groups.includes(n.gid) ? 3 : 0;
    return !!((n.mode >> sh) & bit);
  }

  need(n: VNode, c: Cred, bit: number, p: string): void {
    if (!this.ok(n, c, bit)) bad("EACCES", p);
  }

  at(p: string, cwd: string, c: Cred, follow = true): Hit {
    const abs = norm(p, cwd);
    return this.walk(abs, c, follow, 0);
  }

  private walk(abs: string, c: Cred, follow: boolean, hops: number): Hit {
    if (hops > 32) bad("ELOOP", abs);
    if (abs === "/") return { node: this.root, path: "/" };
    let n: VNode = this.root;
    const done: string[] = [];
    const a = seg(abs);
    for (let i = 0; i < a.length; i++) {
      const d = n instanceof Dir ? n : bad("ENOTDIR", `/${done.join("/")}`);
      this.need(d, c, 1, `/${done.join("/")}` || "/");
      const x = a[i]!;
      const z = d.ent.get(x) ?? bad("ENOENT", abs);
      const last = i === a.length - 1;
      if (z instanceof Sym && (follow || !last)) {
        const base = `/${done.join("/")}`;
        const tail = a.slice(i + 1).join("/");
        const dst = norm(z.to, base || "/") + (tail ? `/${tail}` : "");
        return this.walk(norm(dst), c, follow, hops + 1);
      }
      n = z;
      done.push(x);
    }
    n.at = Date.now();
    return { node: n, path: abs };
  }

  private par(p: string, cwd: string, c: Cred): { dir: Dir; name: string; path: string } {
    const abs = norm(p, cwd);
    if (abs === "/") bad("EBUSY", "/");
    const a = seg(abs);
    const name = a.pop()!;
    if (name.length > 255) bad("ENAMETOOLONG", name);
    const pp = `/${a.join("/")}`;
    const h = this.at(pp, "/", c);
    const d = h.node instanceof Dir ? h.node : bad("ENOTDIR", pp);
    this.need(d, c, 3, pp);
    return { dir: d, name, path: abs };
  }

  readb(p: string, cwd: string, c: Cred): Uint8Array {
    const h = this.at(p, cwd, c);
    this.need(h.node, c, 4, h.path);
    if (h.node instanceof Reg) return h.node.data.slice();
    if (h.node instanceof Chr) return h.node.rfn(65536);
    if (h.node instanceof Dir) bad("EISDIR", h.path);
    return bad("EINVAL", h.path);
  }

  read(p: string, cwd: string, c: Cred): string { return dec(this.readb(p, cwd, c)); }

  writeb(p: string, b: Uint8Array, cwd: string, c: Cred, add = false, mode = 0o666): void {
    let n: VNode;
    let path: string;
    let made: { dir: Dir; name: string } | undefined;
    try {
      const h = this.at(p, cwd, c);
      n = h.node;
      path = h.path;
    } catch (e) {
      if (!(e instanceof KErr) || e.code !== "ENOENT") throw e;
      const q = this.par(p, cwd, c);
      n = new Reg("", mode, c.uid, c.gid);
      q.dir.ent.set(q.name, n);
      made = { dir: q.dir, name: q.name };
      q.dir.touch(true);
      path = q.path;
    }
    this.need(n, c, 2, path);
    if (n instanceof Reg) {
      const old = n.data;
      if (add) {
        const x = new Uint8Array(n.data.length + b.length);
        x.set(n.data);
        x.set(b, n.data.length);
        n.data = x;
      } else n.data = b.slice();
      if (this.used() > this.cap) {
        n.data = old;
        if (made) made.dir.ent.delete(made.name);
        bad("ENOSPC", path);
      }
      n.sum = undefined;
      n.touch(true);
      return;
    }
    if (n instanceof Chr) {
      n.wfn(b);
      n.touch(true);
      return;
    }
    if (n instanceof Dir) bad("EISDIR", path);
    bad("EINVAL", path);
  }

  write(p: string, s: string, cwd: string, c: Cred, add = false, mode = 0o666): void {
    this.writeb(p, enc(s), cwd, c, add, mode);
  }

  mkfile(p: string, data: Uint8Array | string, cwd: string, c: Cred, mode = 0o644): Reg {
    const q = this.par(p, cwd, c);
    if (q.dir.ent.has(q.name)) bad("EEXIST", q.path);
    const n = new Reg(data, mode, c.uid, c.gid);
    q.dir.ent.set(q.name, n);
    if (this.used() > this.cap) { q.dir.ent.delete(q.name); bad("ENOSPC", q.path); }
    q.dir.touch(true);
    return n;
  }

  mkdir(p: string, cwd: string, c: Cred, mode = 0o755): Dir {
    const q = this.par(p, cwd, c);
    if (q.dir.ent.has(q.name)) bad("EEXIST", q.path);
    const n = new Dir(mode, c.uid, c.gid);
    q.dir.ent.set(q.name, n);
    q.dir.touch(true);
    return n;
  }

  char(p: string, r: Rfn, w: Wfn, cwd: string, c: Cred, mode = 0o666, repeat = false): Chr {
    const q = this.par(p, cwd, c);
    if (q.dir.ent.has(q.name)) bad("EEXIST", q.path);
    const n = new Chr(r, w, mode, c.uid, c.gid, repeat);
    q.dir.ent.set(q.name, n);
    return n;
  }

  list(p: string, cwd: string, c: Cred): Array<[string, VNode]> {
    const h = this.at(p, cwd, c);
    const d = h.node instanceof Dir ? h.node : bad("ENOTDIR", h.path);
    this.need(d, c, 5, h.path);
    return [...d.ent].sort(([a], [b]) => a.localeCompare(b));
  }

  rm(p: string, cwd: string, c: Cred, dir = false): void {
    const q = this.par(p, cwd, c);
    const n = q.dir.ent.get(q.name) ?? bad("ENOENT", q.path);
    if (n instanceof Dir) {
      if (!dir) bad("EISDIR", q.path);
      if (n.ent.size) bad("ENOTEMPTY", q.path);
    } else if (dir) bad("ENOTDIR", q.path);
    q.dir.ent.delete(q.name);
    n.nlink--;
    q.dir.touch(true);
  }

  rename(a: string, b: string, cwd: string, c: Cred): void {
    const x = this.par(a, cwd, c);
    const n = x.dir.ent.get(x.name) ?? bad("ENOENT", x.path);
    const y = this.par(b, cwd, c);
    if (x.path === y.path) return;
    const old = y.dir.ent.get(y.name);
    if (old instanceof Dir && !(n instanceof Dir)) bad("EISDIR", y.path);
    if (n instanceof Dir && old && !(old instanceof Dir)) bad("ENOTDIR", y.path);
    if (old instanceof Dir && old.ent.size) bad("ENOTEMPTY", y.path);
    y.dir.ent.set(y.name, n);
    x.dir.ent.delete(x.name);
    if (old) old.nlink--;
    x.dir.touch(true);
    y.dir.touch(true);
  }

  link(a: string, b: string, cwd: string, c: Cred): void {
    const n = this.at(a, cwd, c).node;
    if (n instanceof Dir) bad("EPERM", a);
    const q = this.par(b, cwd, c);
    if (q.dir.ent.has(q.name)) bad("EEXIST", q.path);
    q.dir.ent.set(q.name, n);
    n.nlink++;
    n.touch();
  }

  symlink(to: string, p: string, cwd: string, c: Cred): void {
    const q = this.par(p, cwd, c);
    if (q.dir.ent.has(q.name)) bad("EEXIST", q.path);
    q.dir.ent.set(q.name, new Sym(to, c.uid, c.gid));
    q.dir.touch(true);
  }

  readlink(p: string, cwd: string, c: Cred): string {
    const h = this.at(p, cwd, c, false);
    const n = h.node instanceof Sym ? h.node : bad("EINVAL", h.path);
    return n.to;
  }

  chmod(p: string, mode: number, cwd: string, c: Cred): void {
    const h = this.at(p, cwd, c, false);
    if (c.uid !== 0 && c.uid !== h.node.uid) bad("EPERM", h.path);
    h.node.mode = mode & 0o7777;
    h.node.touch();
  }

  chown(p: string, uid: number, gid: number, cwd: string, c: Cred): void {
    if (c.uid !== 0) bad("EPERM", p);
    const n = this.at(p, cwd, c, false).node;
    n.uid = uid;
    n.gid = gid;
    n.touch();
  }

  utime(p: string, at: number, mt: number, cwd: string, c: Cred, follow = true): void {
    const h = this.at(p, cwd, c, follow);
    if (c.uid !== 0 && c.uid !== h.node.uid) bad("EPERM", h.path);
    h.node.at = at;
    h.node.mt = mt;
    h.node.ct = Date.now();
  }

  stat(p: string, cwd: string, c: Cred, follow = true): St {
    const n = this.at(p, cwd, c, follow).node;
    const size = n instanceof Reg ? n.data.length : n instanceof Dir ? n.ent.size : n instanceof Sym ? enc(n.to).length : 0;
    return { ino: n.ino, kind: n.kind, mode: n.mode, uid: n.uid, gid: n.gid, nlink: n.nlink, size, at: n.at, mt: n.mt, ct: n.ct };
  }

  paths(p: string, cwd: string, c: Cred): string[] {
    const h = this.at(p, cwd, c);
    const out: string[] = [h.path];
    const go = (n: VNode, base: string): void => {
      if (!(n instanceof Dir)) return;
      this.need(n, c, 5, base);
      for (const [k, v] of n.ent) {
        const q = base === "/" ? `/${k}` : `${base}/${k}`;
        out.push(q);
        if (v instanceof Dir) go(v, q);
      }
    };
    go(h.node, h.path);
    return out;
  }

  glob(pat: string, cwd: string, c: Cred): string[] {
    if (!wild(pat)) return [pat];
    const abs = norm(pat, cwd);
    const root = abs.slice(0, Math.max(1, abs.search(/[*?]|\[[^\]]+\]/)));
    const base = root.slice(0, root.lastIndexOf("/")) || "/";
    const rx = wrx(abs);
    try {
      return this.paths(base, "/", c).filter(x => rx.test(x)).map(x => pat.startsWith("/") ? x : x.startsWith(cwd + "/") ? x.slice(cwd.length + 1) : x);
    } catch { return []; }
  }

  used(): number {
    const seen = new Set<number>();
    let n = 0;
    const go = (v: VNode): void => {
      if (seen.has(v.ino)) return;
      seen.add(v.ino);
      n += 128;
      if (v instanceof Reg) n += v.data.length;
      if (v instanceof Dir) for (const x of v.ent.values()) go(x);
    };
    go(this.root);
    return n;
  }
}
