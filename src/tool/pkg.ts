import { fileSum } from "../fs/tree.js";

interface Dent { name: string; }
interface St {
  mode: number; uid: number; gid: number; atimeMs: number; mtimeMs: number; ctimeMs: number;
  dev: number | bigint; ino: number | bigint;
  isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean;
}
interface Fs {
  lstat(p: string): Promise<St>;
  readdir(p: string, o: { withFileTypes: true }): Promise<Dent[]>;
  readFile(p: string): Promise<Uint8Array>;
  readlink(p: string): Promise<string>;
  writeFile(p: string, b: Uint8Array): Promise<void>;
  mkdir(p: string, o: { recursive: true }): Promise<void>;
}
interface Path { resolve(...p: string[]): string; join(...p: string[]): string; relative(a: string, b: string): string; dirname(p: string): string; }
interface Zlib { gzipSync(b: Uint8Array, o: { level: number }): Uint8Array; }
interface Proc { argv: string[]; }
interface Pe {
  p: string; k: "d" | "f" | "l"; id: number; mode: number; uid: number; gid: number;
  at: number; mt: number; ct: number; off?: number; len?: number; sum?: string; to?: string;
}

const mod = (name: string): Promise<unknown> => import(name);
const fs = await mod("node:fs/promises") as Fs, path = await mod("node:path") as Path, z = await mod("node:zlib") as Zlib;
const proc = (globalThis as unknown as { process: Proc }).process, a = proc.argv.slice(2);
const arg = (k: string): string => { const i = a.indexOf(k), v = i >= 0 ? a[i + 1] : undefined; if (!v) throw new Error(`${k} needs a value`); return v; };
const root = path.resolve(arg("--root")), out = path.resolve(arg("--out")), release = arg("--release");

const hash = (b: Uint8Array): number => {
  let n = 0x811c9dc5;
  for (const x of b) { n ^= x; n = Math.imul(n, 0x01000193); }
  return n >>> 0;
};
const enc = new TextEncoder(), ent: Pe[] = [], data: Uint8Array[] = [], seen = new Map<string, number>();
const refs = new Map<number, { off: number; len: number; sum: string }>();
let seq = 0, off = 0;
const id = (s: St): number => { const k = `${s.dev}:${s.ino}`, old = seen.get(k); if (old) return old; const n = ++seq; seen.set(k, n); return n; };

const walk = async (abs: string): Promise<void> => {
  for (const d of (await fs.readdir(abs, { withFileTypes: true })).sort((x, y) => x.name.localeCompare(y.name))) {
    const p = path.join(abs, d.name), rel = path.relative(root, p).replaceAll("\\", "/"), gp = `/${rel}`, s = await fs.lstat(p);
    const q = { p: gp, id: id(s), mode: s.mode & 0o7777, uid: s.uid, gid: s.gid, at: Math.trunc(s.atimeMs), mt: Math.trunc(s.mtimeMs), ct: Math.trunc(s.ctimeMs) };
    if (s.isDirectory()) { ent.push({ ...q, k: "d" }); await walk(p); }
    else if (s.isFile()) {
      let r = refs.get(q.id);
      if (!r) {
        const b = new Uint8Array(await fs.readFile(p));
        r = { off, len: b.length, sum: fileSum(b) }; refs.set(q.id, r); data.push(b); off += b.length;
      }
      ent.push({ ...q, k: "f", ...r });
    }
    else if (s.isSymbolicLink()) ent.push({ ...q, k: "l", to: await fs.readlink(p) });
  }
};

await walk(root);
const h = enc.encode(JSON.stringify({ schema: 1, release, ent })), raw = new Uint8Array(16 + h.length + off), v = new DataView(raw.buffer);
raw.set(enc.encode("THPK")); v.setUint32(4, h.length, true); v.setUint32(8, off, true); raw.set(h, 16);
let at = 16 + h.length; for (const b of data) { raw.set(b, at); at += b.length; }
v.setUint32(12, hash(raw.subarray(16)), true);
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, new Uint8Array(z.gzipSync(raw, { level: 9 })));
console.log(`packed ${ent.length} entries, ${off} payload bytes -> ${out}`);
