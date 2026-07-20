import type { Kern } from "../core/kernel.js";
import { fileSum, treeFs } from "../fs/tree.js";
import type { TreeEnt } from "../fs/tree.js";

const MAGIC = "THPK";
export const TOOLCHAIN = "2.1.0-r2";
const asset = new URL("../../assets/thistle-toolchain.tpk.gz", import.meta.url);

interface Pe {
  p: string;
  k: "d" | "f" | "l";
  id: number;
  mode: number;
  uid: number;
  gid: number;
  at: number;
  mt: number;
  ct: number;
  off?: number;
  len?: number;
  sum?: string;
  to?: string;
}

interface Pm { schema: number; release: string; ent: Pe[]; }
interface Fs { readFile(p: URL): Promise<Uint8Array>; }
interface BunHost { file(p: URL): { arrayBuffer(): Promise<ArrayBuffer> }; }
interface Glob { Bun?: BunHost; document?: unknown; }

const hash = (b: Uint8Array): number => {
  let n = 0x811c9dc5;
  for (const x of b) { n ^= x; n = Math.imul(n, 0x01000193); }
  return n >>> 0;
};

const num = (n: unknown, k: string): number => {
  if (!Number.isSafeInteger(n) || (n as number) < 0) throw new Error(`bad ${k} in root package`);
  return n as number;
};

const bytes = async (): Promise<Uint8Array> => {
  const g = globalThis as unknown as Glob;
  if (g.Bun) return new Uint8Array(await g.Bun.file(asset).arrayBuffer());
  if (g.document) {
    const r = await fetch(asset);
    if (!r.ok) throw new Error(`root package request failed: HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as Fs;
  return new Uint8Array(await fs.readFile(asset));
};

const unzip = async (b: Uint8Array): Promise<Uint8Array> => {
  const ds = new DecompressionStream("gzip");
  const src = new Blob([Uint8Array.from(b).buffer]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(src).arrayBuffer());
};

/** A root package is an overlay, so upgrading tools never replaces /home or /root. */
export class RootPkg {
  async install(k: Kern): Promise<boolean> {
    try { if (k.fs.read("/etc/thistle-toolchain-release", "/", root).trim() === TOOLCHAIN) return false; }
    catch { /* First boot, or an older compiler set. */ }

    const raw = await unzip(await bytes()), v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (raw.length < 16 || new TextDecoder().decode(raw.subarray(0, 4)) !== MAGIC) throw new Error("bad root package magic");
    const hn = v.getUint32(4, true), pn = v.getUint32(8, true);
    if (16 + hn + pn !== raw.length || v.getUint32(12, true) !== hash(raw.subarray(16))) throw new Error("root package length or checksum mismatch");
    const man = JSON.parse(new TextDecoder().decode(raw.subarray(16, 16 + hn))) as Pm;
    if (man.schema !== 1 || man.release !== TOOLCHAIN || !Array.isArray(man.ent)) throw new Error("root package release does not match this kernel");

    const now = treeFs.dump(k.fs), by = new Map(now.map(e => [e.p, e]));
    let base = Math.max(0, ...now.map(e => e.id));
    const ids = new Map<number, number>(), payload = 16 + hn;
    for (const q of man.ent) {
      this.chk(q, pn);
      let id = ids.get(q.id); if (!id) { id = ++base; ids.set(q.id, id); }
      const e: TreeEnt = { p: q.p, k: q.k, id, mode: q.mode, uid: q.uid, gid: q.gid, at: q.at, mt: q.mt, ct: q.ct };
      if (q.k === "f") {
        const off = q.off!, len = q.len!, data = raw.subarray(payload + off, payload + off + len);
        if (q.sum !== fileSum(data)) throw new Error(`root package file checksum mismatch: ${q.p}`);
        e.data = data; e.sum = q.sum!;
      } else if (q.k === "l") e.to = q.to!;
      by.set(q.p, e);
    }
    treeFs.load(k.fs, [...by.values()]);
    k.log(`pkg: installed compiler root ${TOOLCHAIN} (${man.ent.length} entries)`);
    return true;
  }

  private chk(q: Pe, pn: number): void {
    if (!q || typeof q.p !== "string" || !q.p.startsWith("/") || q.p === "/" || q.p.split("/").includes("..")) throw new Error("bad path in root package");
    if (!["d", "f", "l"].includes(q.k)) throw new Error(`bad kind in root package: ${q.p}`);
    for (const [k, n] of [["id", q.id], ["mode", q.mode], ["uid", q.uid], ["gid", q.gid], ["atime", q.at], ["mtime", q.mt], ["ctime", q.ct]] as const) num(n, k);
    if (q.k === "f") {
      const off = num(q.off, "file offset"), len = num(q.len, "file length");
      if (off + len > pn || typeof q.sum !== "string") throw new Error(`bad file payload in root package: ${q.p}`);
    }
    if (q.k === "l" && typeof q.to !== "string") throw new Error(`bad link in root package: ${q.p}`);
  }
}

const root = { uid: 0, gid: 0, groups: [0] };
export const rootPkg = new RootPkg();
