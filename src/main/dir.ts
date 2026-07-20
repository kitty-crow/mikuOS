import { fileSum } from "../fs/tree.js";
import type { Tree, TreeEnt } from "../fs/tree.js";

interface Dent { name: string; isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean; }
interface Stat { mode: number; uid: number; gid: number; atimeMs: number; mtimeMs: number; ctimeMs: number; ino: number | bigint; dev: number | bigint; isFile(): boolean; }
interface Fs {
  mkdir(p: string, o: { recursive: boolean }): Promise<void>;
  readdir(p: string, o: { withFileTypes: true }): Promise<Dent[]>;
  readFile(p: string): Promise<Uint8Array>;
  writeFile(p: string, b: Uint8Array | string): Promise<void>;
  lstat(p: string): Promise<Stat>;
  readlink(p: string): Promise<string>;
  symlink(to: string, p: string): Promise<void>;
  link(a: string, b: string): Promise<void>;
  chmod(p: string, mode: number): Promise<void>;
  rm(p: string, o: { recursive: boolean; force: boolean }): Promise<void>;
  rename(a: string, b: string): Promise<void>;
}
interface Path { readonly sep: string; resolve(...p: string[]): string; join(...p: string[]): string; dirname(p: string): string; relative(a: string, b: string): string; isAbsolute(p: string): boolean; }
interface Url { fileURLToPath(u: URL): string; }
interface Meta extends Omit<TreeEnt, "data" | "source"> {}
interface Man { ver: number; image?: number; ent: Meta[]; }

const mod = (name: string): Promise<unknown> => import(name);
const fs = await mod("node:fs/promises") as Fs;
const path = await mod("node:path") as Path;
const url = await mod("node:url") as Url;
const td = new TextDecoder(), metaName = ".thistle-meta.json";

const meta = (e: TreeEnt): Meta => ({ p: e.p, k: e.k, id: e.id, mode: e.mode, uid: e.uid, gid: e.gid, at: e.at, mt: e.mt, ct: e.ct, ...(e.k === "f" ? { sum: e.sum ?? fileSum(e.data ?? new Uint8Array()) } : {}), ...(e.k === "l" ? { to: e.to } : {}) });

export class DirTree implements Tree {
  readonly label: string;
  private old = new Map<string, Meta>();
  private image = 0;
  private readonly root: string;

  constructor(root: string | URL) {
    this.root = root instanceof URL ? url.fileURLToPath(root) : path.resolve(root);
    if (path.dirname(this.root) === this.root) throw new Error("refusing to use the host filesystem root as a Thistle root");
    this.label = this.root;
  }

  get imageVersion(): number { return this.image; }

  async pull(): Promise<TreeEnt[] | null> {
    await fs.mkdir(this.root, { recursive: true });
    const man = await this.man(), listed = (await fs.readdir(this.root, { withFileTypes: true })).filter(x => x.name !== metaName && x.name !== `${metaName}.tmp`);
    if (!man && !listed.length) return null;
    this.image = man?.image ?? 0;
    this.old = new Map((man?.ent ?? []).map(x => [x.p, x]));
    let seq = Math.max(0, ...[...this.old.values()].map(x => x.id)) + 1;
    const ino = new Map<string, number>(), own = new Map<number, string>(), out: TreeEnt[] = [];
    const nid = (st: Stat, old?: Meta): number => {
      const key = `${st.dev}:${st.ino}`, seen = ino.get(key);
      if (seen) return seen;
      let id = old?.id;
      if (!id || (own.has(id) && own.get(id) !== key)) id = seq++;
      ino.set(key, id); own.set(id, key);
      return id;
    };
    const walk = async (dir: string, rel: string): Promise<void> => {
      const st = await fs.lstat(dir), p = rel ? `/${rel.replaceAll("\\", "/")}` : "/", old = this.old.get(p);
      const base = { p, id: nid(st, old), mode: old?.mode ?? (st.mode & 0o7777), uid: old?.uid ?? st.uid, gid: old?.gid ?? st.gid, at: Math.trunc(st.atimeMs), mt: Math.trunc(st.mtimeMs), ct: Math.trunc(st.ctimeMs) };
      out.push({ ...base, k: "d" });
      for (const d of await fs.readdir(dir, { withFileTypes: true })) {
        if (d.name === metaName || d.name === `${metaName}.tmp`) continue;
        const q = rel ? `${rel}/${d.name}` : d.name, abs = path.join(this.root, q), mp = `/${q.replaceAll("\\", "/")}`, om = this.old.get(mp);
        if (d.isDirectory()) await walk(abs, q);
        else if (d.isFile() || d.isSymbolicLink()) {
          const z = await fs.lstat(abs), raw = d.isFile() ? new Uint8Array(await fs.readFile(abs)) : undefined;
          const mark = om?.k === "l" && raw ? td.decode(raw) : "";
          if (d.isSymbolicLink() || mark.startsWith("THISTLE-LINK ")) {
            const raw = d.isSymbolicLink() ? await fs.readlink(abs) : mark.replace(/^THISTLE-LINK /, "").trimEnd();
            const to = d.isSymbolicLink() ? this.source(mp, raw, om?.k === "l" ? om.to : undefined) : raw;
            out.push({ p: mp, k: "l", id: nid(z, om), mode: om?.mode ?? (z.mode & 0o7777), uid: om?.uid ?? z.uid, gid: om?.gid ?? z.gid, at: Math.trunc(z.atimeMs), mt: Math.trunc(z.mtimeMs), ct: Math.trunc(z.ctimeMs), to });
          } else {
            out.push({ p: mp, k: "f", id: nid(z, om), mode: om?.mode ?? (z.mode & 0o7777), uid: om?.uid ?? z.uid, gid: om?.gid ?? z.gid, at: Math.trunc(z.atimeMs), mt: Math.trunc(z.mtimeMs), ct: Math.trunc(z.ctimeMs), data: raw!, sum: fileSum(raw!) });
          }
        } else {
          // FIFOs and sockets belong to the host. Importing them as inert files would be a lie.
          continue;
        }
      }
    };
    await walk(this.root, "");
    this.old = new Map(out.map(e => [e.p, meta(e)]));
    return out;
  }

  async push(ent: TreeEnt[], imageVersion = this.image): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    for (const e of [...this.old.values()].filter(x => x.k === "d").sort((a, b) => a.p.length - b.p.length)) {
      try { await fs.chmod(this.abs(e.p), e.mode | 0o700); } catch { /* The host may own stricter policy than us. */ }
    }
    const now = new Map(ent.map(x => [x.p, x]));
    for (const p of [...this.old.keys()].filter(x => x !== "/" && !now.has(x)).sort((a, b) => b.length - a.length)) await fs.rm(this.abs(p), { recursive: true, force: true });
    const dirs = ent.filter(x => x.k === "d").sort((a, b) => a.p.length - b.p.length);
    for (const e of dirs) {
      if (e.p !== "/") await fs.mkdir(this.abs(e.p), { recursive: true });
      try { await fs.chmod(this.abs(e.p), e.mode | 0o700); } catch { /* Enough room to sync, if the host permits it. */ }
    }
    const first = new Map<number, string>();
    for (const e of ent.filter(x => x.k !== "d").sort((a, b) => a.p.localeCompare(b.p))) {
      const p = this.abs(e.p), old = this.old.get(e.p);
      await fs.mkdir(path.dirname(p), { recursive: true });
      if (e.k === "f") {
        const data = e.data ?? new Uint8Array(), hash = e.sum ?? fileSum(data), src = first.get(e.id);
        if (src) { if (!(await this.same(src, p))) { await fs.rm(p, { recursive: true, force: true }); await fs.link(src, p); } }
        else { first.set(e.id, p); if (old?.k !== "f" || old.sum !== hash || !(await this.file(p))) { await fs.rm(p, { recursive: true, force: true }); await fs.writeFile(p, data); } }
      } else {
        const to = e.to ?? "", target = this.target(e.p, to);
        const state = old?.k === "l" && old.to === to
          ? await this.linkState(p, target, to)
          : "missing";
        if (state !== "correct") {
          await fs.rm(p, { recursive: true, force: true });
          if (state === "wrong") {
            await fs.writeFile(p, `THISTLE-LINK ${to}\n`);
          } else {
            try { await fs.symlink(target, p); }
            catch { await fs.writeFile(p, `THISTLE-LINK ${to}\n`); }
          }
        }
      }
      try { await fs.chmod(p, e.mode); } catch { /* Host ACLs get the final word. */ }
    }
    const next: Meta[] = ent.map(meta);
    const tmp = path.join(this.root, `${metaName}.tmp`), dst = path.join(this.root, metaName);
    await fs.writeFile(tmp, JSON.stringify({ ver: 1, image: imageVersion, ent: next } satisfies Man, null, 2) + "\n");
    await fs.rename(tmp, dst);
    for (const e of [...dirs].reverse()) try { await fs.chmod(this.abs(e.p), e.mode); } catch { /* Host ACLs get the final word. */ }
    this.old = new Map(next.map(x => [x.p, x]));
    this.image = imageVersion;
  }

  private abs(p: string): string {
    const q = path.resolve(this.root, `.${p}`);
    if (q !== this.root && !q.startsWith(this.root + path.sep)) throw new Error(`host tree path escapes root: ${p}`);
    return q;
  }

  private target(p: string, to: string): string {
    if (!to.startsWith("/")) return to;
    return path.relative(path.dirname(this.abs(p)), this.abs(to)) || ".";
  }

  private source(p: string, raw: string, old?: string): string {
    if (old !== undefined && raw === this.target(p, old)) return old;
    if (!path.isAbsolute(raw)) return raw;
    const q = path.resolve(raw);
    if (q === this.root || q.startsWith(this.root + path.sep)) return `/${path.relative(this.root, q).replaceAll("\\", "/")}`;
    // An existing link is not allowed to acquire a host-side escape on reboot.
    return old ?? raw.replaceAll("\\", "/");
  }

  private async file(p: string): Promise<boolean> { try { return (await fs.lstat(p)).isFile(); } catch (e) { if ((e as { code?: string }).code === "ENOENT") return false; throw e; } }
  private async same(a: string, b: string): Promise<boolean> {
    try { const x = await fs.lstat(a), y = await fs.lstat(b); return x.dev === y.dev && x.ino === y.ino; }
    catch (e) { if ((e as { code?: string }).code === "ENOENT") return false; throw e; }
  }
  private async linkState(p: string, target: string, guest: string): Promise<"correct" | "missing" | "wrong"> {
    try { return await fs.readlink(p) === target ? "correct" : "wrong"; }
    catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "ENOENT") return "missing";
      if (code !== "EINVAL") throw e;
      try {
        return td.decode(await fs.readFile(p)) === `THISTLE-LINK ${guest}\n`
          ? "correct"
          : "wrong";
      } catch (readError) {
        if ((readError as { code?: string }).code === "ENOENT") return "missing";
        throw readError;
      }
    }
  }

  private async man(): Promise<Man | null> {
    try { const x = JSON.parse(td.decode(await fs.readFile(path.join(this.root, metaName)))) as Man; return x.ver === 1 && Array.isArray(x.ent) ? x : null; }
    catch (e) { if ((e as { code?: string }).code === "ENOENT") return null; throw e; }
  }
}
