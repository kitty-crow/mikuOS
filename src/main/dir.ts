import { readTreeManifest, type TreeMeta as Meta, type TreeManifest as Man } from "../fs/tree-meta.js";
import { hostModule } from "./host-module.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { fileSum } from "../fs/tree.js";
import type { Tree, TreeEnt } from "../fs/tree.js";
import { ROOT_IMAGE_VERSION } from "./image.js";

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


const fs = await hostModule("node:fs/promises") as Fs;
const path = await hostModule("node:path") as Path;
const url = await hostModule("node:url") as Url;
const td = new TextDecoder(), metaName = ".thistle-meta.json";

const meta = (e: TreeEnt): Meta => ({"size": null, p: e.p, k: e.k, id: e.id, mode: e.mode, uid: e.uid, gid: e.gid, at: e.at, mt: e.mt, ct: e.ct, sum: e.k === "f" ? e.sum ?? fileSum(e.data ?? new Uint8Array()) : null, to: e.k === "l" ? e.to : null });

export class DirTree implements Tree {
  readonly label: string;
  private old = new Map<string, Meta>();
  private image = 0;
  private readonly root: string;

  private readonly baseRoot: string | null = null;

  constructor(root: string | URL, base: URL | null = null, private readonly upgradeLegacy = false) {
    this.root = root instanceof URL ? url.fileURLToPath(root) : path.resolve(root);
    if (path.dirname(this.root) === this.root) throw new Error("refusing to use the host filesystem root as a Thistle root");
    this.baseRoot = base ? path.resolve(url.fileURLToPath(base)) : null;
    if (this.baseRoot && (path.resolve(this.root) === this.baseRoot || path.resolve(this.root).startsWith(this.baseRoot + path.sep) || this.baseRoot.startsWith(path.resolve(this.root) + path.sep))) {
      throw new Error("the immutable base and writable guest root must be separate");
    }
    this.label = this.root;
  }

  get imageVersion(): number { return this.image; }

  async pull(): Promise<TreeEnt[] | null> {
    await fs.mkdir(this.root, { recursive: true });
    const man = await this.man(), listed = (await fs.readdir(this.root, { withFileTypes: true })).filter(x => x.name !== metaName && x.name !== `${metaName}.tmp`);
    if (!man && !listed.length) {
      // Persistence compares an inode and its current backing file within one update.
      //@cg-expect-warning
      if (!this.baseRoot) return null;
      this.old.clear();
      this.image = 0;
      return this.readBase();
    }
    this.image = withValue(man ?? null, value => value.image) ?? 0;
    this.old = new Map((withValue(man ?? null, value => value.ent) ?? []).map(x => [x.p, x]));
    let seq = Math.max(0, ...[...this.old.values()].map(x => x.id)) + 1;
    const ino = new Map<string, number>(), own = new Map<number, string>(), out: TreeEnt[] = [];
    const nid = (st: Stat, old: Meta | null = null): number => {
      const key = `${st.dev}:${st.ino}`, seen = (ino.get(key) ?? null);
      if (seen) return seen;
      let id = withValue(old ?? null, value => value.id);
      if (!id || (own.has(id) && (own.get(id) ?? null) !== key)) id = seq++;
      ino.set(key, id); own.set(id, key);
      return id;
    };
    const walk = async (dir: string, rel: string): Promise<void> => {
      const st = await fs.lstat(dir), p = rel ? `/${rel.replaceAll("\\", "/")}` : "/", old = (this.old.get(p) ?? null);
      const base = { p, id: nid(st, old), mode: withValue(old ?? null, value => value.mode) ?? (st.mode & 0o7777), uid: withValue(old ?? null, value => value.uid) ?? st.uid, gid: withValue(old ?? null, value => value.gid) ?? st.gid, at: Math.trunc(st.atimeMs), mt: Math.trunc(st.mtimeMs), ct: Math.trunc(st.ctimeMs) };
      out.push({"data": null, "sum": null, "size": null, "source": null, "to": null, ...base, k: "d" });
      for (const d of await fs.readdir(dir, { withFileTypes: true })) {
        if (d.name === metaName || d.name === `${metaName}.tmp`) continue;
        const q = rel ? `${rel}/${d.name}` : d.name, abs = path.join(this.root, q), mp = `/${q.replaceAll("\\", "/")}`, om = (this.old.get(mp) ?? null);
        switch (true) {
case !!(d.isDirectory()): { await walk(abs, q);
break; }
case !!(d.isFile() || d.isSymbolicLink()): {
          const z = await fs.lstat(abs), raw = d.isFile() ? new Uint8Array(await fs.readFile(abs)) : null;
          const mark = withValue(om ?? null, value => value.k) === "l" && raw ? td.decode(raw) : "";
          if (d.isSymbolicLink() || mark.startsWith("THISTLE-LINK ")) {
            const raw = d.isSymbolicLink() ? await fs.readlink(abs) : mark.replace(/^THISTLE-LINK /, "").trimEnd();
            const to = d.isSymbolicLink() ? this.source(mp, raw, withValue(om ?? null, value => value.k) === "l" ? requireValue(om ?? null, "src/main/dir.ts:90").to : null) : raw;
            out.push({"data": null, "sum": null, "size": null, "source": null, p: mp, k: "l", id: nid(z, om), mode: withValue(om ?? null, value => value.mode) ?? (z.mode & 0o7777), uid: withValue(om ?? null, value => value.uid) ?? z.uid, gid: withValue(om ?? null, value => value.gid) ?? z.gid, at: Math.trunc(z.atimeMs), mt: Math.trunc(z.mtimeMs), ct: Math.trunc(z.ctimeMs), to });
          } else {
            out.push({"size": null, "source": null, "to": null, p: mp, k: "f", id: nid(z, om), mode: withValue(om ?? null, value => value.mode) ?? (z.mode & 0o7777), uid: withValue(om ?? null, value => value.uid) ?? z.uid, gid: withValue(om ?? null, value => value.gid) ?? z.gid, at: Math.trunc(z.atimeMs), mt: Math.trunc(z.mtimeMs), ct: Math.trunc(z.ctimeMs), data: requireValue(raw ?? null, "src/main/dir.ts:90"), sum: fileSum(requireValue(raw ?? null, "src/main/dir.ts:90")) });
          }

break; }
default: {
          // FIFOs and sockets belong to the host. Importing them as inert files would be a lie.
          continue;
         }
}
      }
    };
    await walk(this.root, "");
    this.old = new Map(out.map(e => [e.p, meta(e)]));
    if (this.baseRoot && this.upgradeLegacy && this.image < ROOT_IMAGE_VERSION) {
      return addMissingSystemFiles(out, await this.readBase());
    }
    return out;
  }

  async push(ent: TreeEnt[], imageVersion: number | null = this.image): Promise<void> {
    imageVersion ??= this.image;
    await fs.mkdir(this.root, { recursive: true });
    for (const e of [...this.old.values()].filter(x => x.k === "d").sort((a, b) => a.p.length - b.p.length)) {
      // This documented best-effort fallback intentionally continues after the optional operation fails.
      //@cg-expect-warning
      try { await fs.chmod(this.abs(e.p), e.mode | 0o700); } catch { /* The host may own stricter policy than us. */ }
    }
    const now = new Map(ent.map(x => [x.p, x]));
    for (const p of [...this.old.keys()].filter(x => x !== "/" && !now.has(x)).sort((a, b) => b.length - a.length)) await fs.rm(this.abs(p), { recursive: true, force: true });
    const dirs = ent.filter(x => x.k === "d").sort((a, b) => a.p.length - b.p.length);
    for (const e of dirs) {
      if (e.p !== "/") await fs.mkdir(this.abs(e.p), { recursive: true });
      // This documented best-effort fallback intentionally continues after the optional operation fails.
      //@cg-expect-warning
      try { await fs.chmod(this.abs(e.p), e.mode | 0o700); } catch { /* Enough room to sync, if the host permits it. */ }
    }
    const first = new Map<number, string>();
    for (const e of ent.filter(x => x.k !== "d").sort((a, b) => a.p.localeCompare(b.p))) {
      const p = this.abs(e.p), old = (this.old.get(e.p) ?? null);
      await fs.mkdir(path.dirname(p), { recursive: true });
      if (e.k === "f") {
        const data = e.data ?? new Uint8Array(), hash = e.sum ?? fileSum(data), src = (first.get(e.id) ?? null);
        // Persistence compares an inode and its current backing file within one update.
        //@cg-expect-warning
        if (src) { if (!(await this.same(src, p))) { await fs.rm(p, { recursive: true, force: true }); await fs.link(src, p); } }
        // Persistence compares an inode and its current backing file within one update.
        //@cg-expect-warning
        else { first.set(e.id, p); if (withValue(old ?? null, value => value.k) !== "f" || requireValue(old ?? null, "src/main/dir.ts:129").sum !== hash || !(await this.file(p))) { await fs.rm(p, { recursive: true, force: true }); await fs.writeFile(p, data); } }
      } else {
        const to = e.to ?? "", target = this.target(e.p, to);
        const state = withValue(old ?? null, value => value.k) === "l" && requireValue(old ?? null, "src/main/dir.ts:132").to === to
          ? await linkState(p, target, to)
          : "missing";
        // Persistence compares an inode and its current backing file within one update.
        //@cg-expect-warning
        if (state !== "correct") {
          await fs.rm(p, { recursive: true, force: true });
          // Persistence compares an inode and its current backing file within one update.
          //@cg-expect-warning
          if (state === "wrong") {
            await fs.writeFile(p, `THISTLE-LINK ${to}\n`);
          } else {
            try { await fs.symlink(target, p); }
            catch { await fs.writeFile(p, `THISTLE-LINK ${to}\n`); }
          }
        }
      }
      // This documented best-effort fallback intentionally continues after the optional operation fails.
      //@cg-expect-warning
      try { await fs.chmod(p, e.mode); } catch { /* Host ACLs get the final word. */ }
    }
    const next: Meta[] = ent.map(meta);
    const tmp = path.join(this.root, `${metaName}.tmp`), dst = path.join(this.root, metaName);
    await fs.writeFile(tmp, JSON.stringify({ ver: 1, image: imageVersion, ent: next } satisfies Man, null, 2) + "\n");
    await fs.rename(tmp, dst);
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
    for (const e of [...dirs].reverse()) try { await fs.chmod(this.abs(e.p), e.mode); } catch { /* Host ACLs get the final word. */ }
    this.old = new Map(next.map(x => [x.p, x]));
    this.image = imageVersion;
  }


  /** Read the committed guest metadata, including directories Git omits. */
  private async readBase(): Promise<TreeEnt[]> {
    const root = requireValue(this.baseRoot ?? null, "src/main/dir.ts:155");
    const manifest = readTreeManifest(td.decode(await fs.readFile(path.join(root, metaName))));
    if (manifest.ver !== 1 || !Array.isArray(manifest.ent) || !manifest.ent.some(e => e.p === "/" && e.k === "d")) {
      throw new Error("invalid committed root image metadata");
    }
    const entries: TreeEnt[] = [];
    const payloads = new Map<number, Uint8Array>();
    const seen = new Set<string>();
    for (const entry of manifest.ent) {
      if (!entry.p.startsWith("/") || entry.p.split("/").includes("..") || seen.has(entry.p) ||
          !["d", "f", "l"].includes(entry.k)) throw new Error("invalid committed root path: " + entry.p);
      seen.add(entry.p);
      if (entry.p === "/" + metaName || entry.p === "/dev" || entry.p.startsWith("/dev/") ||
          entry.p === "/proc" || entry.p.startsWith("/proc/")) continue;
      if (entry.k === "f") {
        let data = (payloads.get(entry.id) ?? null);
        // Persistence compares an inode and its current backing file within one update.
        //@cg-expect-warning
        if (!data) {
          data = new Uint8Array(await fs.readFile(path.join(root, entry.p.slice(1))));
          payloads.set(entry.id, data);
        }
        entries.push({"source": null, ...entry, data, sum: fileSum(data), size: data.length });
      } else entries.push({"data": null, "source": null, ...entry });
    }
    return entries;
  }

  /** Migrate old default CLI roots without replacing existing paths. */


  private abs(p: string): string {
    const q = path.resolve(this.root, `.${p}`);
    if (q !== this.root && !q.startsWith(this.root + path.sep)) throw new Error(`host tree path escapes root: ${p}`);
    return q;
  }

  private target(p: string, to: string): string {
    if (!to.startsWith("/")) return to;
    return path.relative(path.dirname(this.abs(p)), this.abs(to)) || ".";
  }

  private source(p: string, raw: string, old: string | null = null): string {
    if (old !== null && raw === this.target(p, old)) return old;
    if (!path.isAbsolute(raw)) return raw;
    const q = path.resolve(raw);
    if (q === this.root || q.startsWith(this.root + path.sep)) return `/${path.relative(this.root, q).replaceAll("\\", "/")}`;
    // An existing link is not allowed to acquire a host-side escape on reboot.
    return old ?? raw.replaceAll("\\", "/");
  }

  private async file(p: string): Promise<boolean> { try { return (await fs.lstat(p)).isFile(); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if ((e as Error & { code: string | null }).code === "ENOENT") return false; throw e; } }
  private async same(a: string, b: string): Promise<boolean> {
    try { const x = await fs.lstat(a), y = await fs.lstat(b); return x.dev === y.dev && x.ino === y.ino; }
    catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if ((e as Error & { code: string | null }).code === "ENOENT") return false; throw e; }
  }


  private async man(): Promise<Man | null> {
    try { const x = readTreeManifest(td.decode(await fs.readFile(path.join(this.root, metaName)))); return x.ver === 1 && Array.isArray(x.ent) ? x : null; }
    catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if ((e as Error & { code: string | null }).code === "ENOENT") return null; throw e; }
  }
}

function addMissingSystemFiles(current: TreeEnt[], base: TreeEnt[]): TreeEnt[] {
    const byPath = new Map(current.map(entry => [entry.p, entry]));
    const ids = new Map<number, number>();
    let next = Math.max(0, ...current.map(entry => entry.id));
    const system = /^\/(?:bin|sbin|usr|etc|boot|lib|lib64|opt)(?:\/|$)/;
    for (const entry of [...base].sort((a, b) => a.p.split("/").length - b.p.split("/").length)) {
      if (!system.test(entry.p) || byPath.has(entry.p)) continue;
      const parent = entry.p.slice(0, entry.p.lastIndexOf("/")) || "/";
      if (withValue((byPath.get(parent) ?? null) ?? null, value => value.k) !== "d") continue;
      let id = (ids.get(entry.id) ?? null);
      if (id === null) { id = ++next; ids.set(entry.id, id); }
      byPath.set(entry.p, { ...entry, id });
    }
    return [...byPath.values()];
  }
async function linkState(p: string, target: string, guest: string): Promise<"correct" | "missing" | "wrong"> {
    try { return await fs.readlink(p) === target ? "correct" : "wrong"; }
    catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      const code = (e as Error & { code: string | null }).code;
      if (code === "ENOENT") return "missing";
      if (code !== "EINVAL") throw e;
      try {
        return td.decode(await fs.readFile(p)) === `THISTLE-LINK ${guest}\n`
          ? "correct"
          : "wrong";
      } catch (caughtValue) { const readError = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
        if ((readError as Error & { code: string | null }).code === "ENOENT") return "missing";
        throw readError;
      }
    }
  }
