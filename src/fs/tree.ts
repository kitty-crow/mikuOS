import { bad } from "../core/err.js";
import { Chr, Dir, Reg, Sym, Vfs } from "./vfs.js";
import type { RegSource, VNode } from "./vfs.js";

export interface TreeEnt {
  p: string;
  k: "d" | "f" | "l";
  id: number;
  mode: number;
  uid: number;
  gid: number;
  at: number;
  mt: number;
  ct: number;
  data?: Uint8Array;
  sum?: string;
  size?: number;
  source?: RegSource;
  to?: string;
}

export type TreeListener = (entries: TreeEnt[], imageVersion: number, generation: number) => void | Promise<void>;

export interface Tree {
  readonly label: string;
  readonly imageVersion?: number;
  readonly generation?: number;
  pull(): Promise<TreeEnt[] | null>;
  push(ent: TreeEnt[], imageVersion?: number): Promise<TreeEnt[] | void>;
  subscribe?(listener: TreeListener): Promise<() => void>;
}

const root = { uid: 0, gid: 0, groups: [0] };

export const fileSum = (b: Uint8Array): string => {
  let n = 0x811c9dc5;
  for (const x of b) { n ^= x; n = Math.imul(n, 0x01000193); }
  return `${b.length}:${(n >>> 0).toString(16)}`;
};

export class TreeFs {
  dump(fs: Vfs, mount = "/"): TreeEnt[] {
    const h = fs.at(mount, "/", root), base = h.node instanceof Dir ? h.node : bad("ENOTDIR", mount), out: TreeEnt[] = [], ids = new Map<number, number>();
    let seq = 1;
    const go = (n: VNode, p: string): void => {
      if (n instanceof Chr) return;
      let id = ids.get(n.ino); if (!id) { id = seq++; ids.set(n.ino, id); }
      const e: TreeEnt = { p, k: n instanceof Dir ? "d" : n instanceof Reg ? "f" : "l", id, mode: n.mode, uid: n.uid, gid: n.gid, at: n.at, mt: n.mt, ct: n.ct };
      if (n instanceof Reg) {
        e.sum = n.sum ?? (n.source?.sum ?? (n.sum = fileSum(n.data)));
        e.size = n.size;
        if (n.lazy && n.source) e.source = n.source;
        else e.data = n.data;
      }
      if (n instanceof Sym) e.to = n.to;
      out.push(e);
      if (n instanceof Dir) for (const [name, x] of [...n.ent].sort(([a], [b]) => a.localeCompare(b))) go(x, p === "/" ? `/${name}` : `${p}/${name}`);
    };
    go(base, "/");
    return out;
  }

  load(fs: Vfs, ent: TreeEnt[], mount = "/"): void {
    const h = fs.at(mount, "/", root), base = h.node instanceof Dir ? h.node : bad("ENOTDIR", mount);
    for (const e of ent) this.chk(e);
    base.ent.clear();
    const ids = new Map<number, VNode>(), defs = new Map<number, TreeEnt>();
    for (const e of ent) if (!defs.has(e.id) || e.data || e.to) defs.set(e.id, e);
    for (const e of [...ent].sort((a, b) => a.p.split("/").length - b.p.split("/").length)) {
      if (e.p === "/") { this.attr(base, e); ids.set(e.id, base); continue; }
      const [d, name] = this.par(base, e.p);
      let n = ids.get(e.id);
      if (!n) {
        const q = defs.get(e.id) ?? e;
        n = e.k === "d"
          ? new Dir()
          : e.k === "f"
            ? new Reg(q.data ?? new Uint8Array(), 0o644, 0, 0, q.source, false)
            : new Sym(q.to ?? "");
        if (n instanceof Reg && q.sum !== undefined) n.sum = q.sum;
        n.nlink = 0; ids.set(e.id, n); this.attr(n, e);
      }
      d.ent.set(name, n); n.nlink++;
    }
    if (fs.used() > fs.cap) throw new Error(`${mount} exceeds this host's VFS budget`);
  }

  private par(root: Dir, p: string): [Dir, string] {
    const a = p.split("/").filter(Boolean), name = a.pop();
    if (!name) throw new Error("bad host tree path");
    let d = root;
    for (const x of a) {
      const n = d.ent.get(x), q = n instanceof Dir ? n : new Dir();
      if (q !== n) d.ent.set(x, q);
      d = q;
    }
    return [d, name];
  }

  private attr(n: VNode, e: TreeEnt): void { n.mode = e.mode; n.uid = e.uid; n.gid = e.gid; n.at = e.at; n.mt = e.mt; n.ct = e.ct; }

  private chk(e: TreeEnt): void {
    if (!e || typeof e.p !== "string" || !e.p.startsWith("/") || e.p.split("/").includes("..") || !["d", "f", "l"].includes(e.k) || !Number.isSafeInteger(e.id) || e.id < 1) throw new Error("bad host tree entry");
    for (const n of [e.mode, e.uid, e.gid, e.at, e.mt, e.ct]) if (!Number.isSafeInteger(n) || n < 0) throw new Error("bad host tree metadata");
    if (e.k === "f") {
      const hasData = e.data instanceof Uint8Array;
      const hasSource = !!e.source && Number.isSafeInteger(e.source.size) && e.source.size >= 0 && typeof e.source.sum === "string" && typeof e.source.load === "function";
      if (!hasData && !hasSource || e.sum !== undefined && typeof e.sum !== "string" || e.size !== undefined && (!Number.isSafeInteger(e.size) || e.size < 0)) throw new Error("bad host tree payload");
    }
    if (e.k === "l" && typeof e.to !== "string") throw new Error("bad host tree payload");
  }
}

export const treeFs = new TreeFs();
