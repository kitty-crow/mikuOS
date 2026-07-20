import { fileSum } from "../fs/tree.js";
import type { Tree, TreeEnt } from "../fs/tree.js";
import type { RegSource } from "../fs/vfs.js";
import type {
  WebRootEntry,
  WebRootFileEntry,
  WebRootManifest,
} from "./webroot-format.js";

interface FH { kind: "file" | "directory"; name: string; }
interface FF extends FH {
  kind: "file";
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(bytes: Uint8Array | string): Promise<void>;
    close(): Promise<void>;
  }>;
}
interface FD extends FH {
  kind: "directory";
  entries(): AsyncIterableIterator<[string, FH]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FD>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FF>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}
interface Nav { storage?: { getDirectory(): Promise<FD> }; }
interface Pick { showDirectoryPicker?(): Promise<FD>; }

interface OverlayMeta extends Omit<TreeEnt, "data" | "source"> {
  base?: boolean;
}
interface OverlayManifest {
  format: 2;
  image: number;
  entries: OverlayMeta[];
  whiteouts: string[];
}

const overlayName = ".thistle-overlay.json";

const fromHex = (value: string): Uint8Array => {
  if (value.length % 2 || /[^0-9a-f]/i.test(value)) throw new Error("bad web-root prefix");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const fetchOk = async (url: URL): Promise<Response> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status}`);
  return response;
};

const inflate = async (url: URL): Promise<Uint8Array> => {
  const response = await fetchOk(url);
  if (!response.body) throw new Error(`${url.pathname}: empty compressed response`);
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const fileMeta = (entry: TreeEnt): { size: number; sum: string } => {
  const data = entry.data;
  return {
    size: entry.size ?? entry.source?.size ?? data?.length ?? 0,
    sum: entry.sum ?? entry.source?.sum ?? fileSum(data ?? new Uint8Array()),
  };
};

const metadata = (entry: TreeEnt): OverlayMeta => ({
  p: entry.p,
  k: entry.k,
  id: entry.id,
  mode: entry.mode,
  uid: entry.uid,
  gid: entry.gid,
  at: entry.at,
  mt: entry.mt,
  ct: entry.ct,
  ...(entry.k === "f" ? fileMeta(entry) : {}),
  ...(entry.k === "l" ? { to: entry.to } : {}),
});

const sameBase = (left: TreeEnt, right: TreeEnt): boolean => {
  if (
    left.k !== right.k ||
    left.mode !== right.mode ||
    left.uid !== right.uid ||
    left.gid !== right.gid
  ) return false;
  if (left.k === "l") return left.to === right.to;
  if (left.k === "f") {
    const a = fileMeta(left);
    const b = fileMeta(right);
    return a.size === b.size && a.sum === b.sum;
  }
  return true;
};

const baseContent = (left: TreeEnt, right: TreeEnt): boolean => {
  if (left.k !== "f" || right.k !== "f") return false;
  const a = fileMeta(left);
  const b = fileMeta(right);
  return a.size === b.size && a.sum === b.sum;
};

/** Complete immutable static root plus an optional, small OPFS write overlay. */
export class WebTree implements Tree {
  private readonly manifestUrl: URL;
  private readonly basePromise: Promise<TreeEnt[]>;
  private baseEntries: TreeEnt[] = [];
  private base = new Map<string, TreeEnt>();
  private overlay: OverlayManifest | null = null;
  private root: Promise<FD | null>;
  private image = 0;
  private name = "static web root";
  readonly persistent: boolean;

  constructor(base: string | URL = new URL("./root/", document.baseURI), persistence = true) {
    const root = base instanceof URL ? base : new URL(base, document.baseURI);
    this.manifestUrl = new URL("manifest.json", root);
    const storage = (navigator as unknown as Nav).storage;
    this.persistent = persistence && !!storage?.getDirectory;
    this.root = this.persistent
      ? storage!.getDirectory().then(dir => dir.getDirectoryHandle(".mikuos", { create: true }))
      : Promise.resolve(null);
    this.basePromise = this.loadBase();
  }

  get label(): string { return this.persistent ? `${this.name} + OPFS overlay` : this.name; }
  get imageVersion(): number { return this.image; }

  async pick(): Promise<boolean> {
    const fn = (globalThis as unknown as Pick).showDirectoryPicker;
    if (!fn) return false;
    const selected = await fn();
    this.root = Promise.resolve(await selected.getDirectoryHandle(".mikuos", { create: true }));
    this.name = `${selected.name}/static web root`;
    this.overlay = null;
    return true;
  }

  async pull(): Promise<TreeEnt[]> {
    const base = await this.basePromise;
    const root = await this.root;
    if (!root) {
      this.image = this.baseImage();
      return base;
    }

    const overlay = await this.readManifest(root);
    this.overlay = overlay;
    if (!overlay) {
      this.image = this.baseImage();
      return base;
    }

    const merged = new Map(base.map(entry => [entry.p, entry]));
    for (const path of overlay.whiteouts) {
      for (const key of [...merged.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) merged.delete(key);
      }
    }

    for (const entry of overlay.entries) {
      const current = this.base.get(entry.p);
      if (entry.k === "f") {
        if (entry.base) {
          if (!current || current.k !== "f") throw new Error(`missing static base file ${entry.p}`);
          const mergedEntry: TreeEnt = { ...current, ...entry };
          if (current.data) mergedEntry.data = current.data;
          if (current.source) mergedEntry.source = current.source;
          merged.set(entry.p, mergedEntry);
        } else {
          const data = await this.readData(root, entry.p);
          merged.set(entry.p, { ...entry, data, sum: entry.sum ?? fileSum(data), size: data.length });
        }
      } else {
        merged.set(entry.p, entry);
      }
    }

    this.image = overlay.image;
    return [...merged.values()].sort((a, b) =>
      a.p.split("/").length - b.p.split("/").length || a.p.localeCompare(b.p),
    );
  }

  async push(entries: TreeEnt[], imageVersion = this.image): Promise<void> {
    await this.basePromise;
    const root = await this.root;
    if (!root) return;

    const now = new Map(entries.map(entry => [entry.p, entry]));
    const whiteouts = this.whiteouts(now);
    const changed: OverlayMeta[] = [];

    for (const entry of entries) {
      const original = this.base.get(entry.p);
      if (original && sameBase(entry, original)) continue;

      const out = metadata(entry);
      if (entry.k === "f") {
        if (original && baseContent(entry, original)) {
          out.base = true;
        } else {
          if (!(entry.data instanceof Uint8Array)) {
            throw new Error(`modified web-root file has no resident payload: ${entry.p}`);
          }
          await this.writeData(root, entry.p, entry.data);
        }
      }
      changed.push(out);
    }

    const nextData = new Set(changed.filter(entry => entry.k === "f" && !entry.base).map(entry => entry.p));
    for (const entry of this.overlay?.entries ?? []) {
      if (entry.k === "f" && !entry.base && !nextData.has(entry.p)) await this.removeData(root, entry.p);
    }

    const manifest: OverlayManifest = {
      format: 2,
      image: imageVersion,
      entries: changed,
      whiteouts,
    };
    await this.writeText(root, overlayName, JSON.stringify(manifest, null, 2) + "\n");
    this.overlay = manifest;
    this.image = imageVersion;
  }

  private baseImage(): number {
    return this.image || 0;
  }

  private async loadBase(): Promise<TreeEnt[]> {
    const manifest = await (await fetchOk(this.manifestUrl)).json() as WebRootManifest;
    if (manifest.format !== 1 || !Array.isArray(manifest.entries)) throw new Error("unsupported static web-root manifest");
    const core = await inflate(new URL(manifest.core.path, this.manifestUrl));
    if (core.length !== manifest.core.unpackedSize) throw new Error("static web-root core size mismatch");

    const entries = manifest.entries.map(entry => this.baseEntry(entry, core));
    this.baseEntries = entries;
    this.base = new Map(entries.map(entry => [entry.p, entry]));
    this.image = manifest.image;
    return entries;
  }

  private baseEntry(entry: WebRootEntry, core: Uint8Array): TreeEnt {
    if (entry.k === "d") return { ...entry };
    if (entry.k === "l") return { ...entry };
    const file = entry as WebRootFileEntry;
    if (file.ref.kind === "core") {
      const data = core.subarray(file.ref.offset, file.ref.offset + file.ref.length);
      if (data.length !== file.size || fileSum(data) !== file.sum) throw new Error(`bad static web-root core entry ${file.p}`);
      return { ...file, data, size: file.size, sum: file.sum };
    }

    const url = new URL(file.ref.path, this.manifestUrl);
    const source: RegSource = {
      size: file.size,
      sum: file.sum,
      head: fromHex(file.head),
      load: async () => {
        const data = await inflate(url);
        if (data.length !== file.size || fileSum(data) !== file.sum) throw new Error(`bad static web-root blob ${file.p}`);
        return data;
      },
    };
    return { ...file, source, size: file.size, sum: file.sum };
  }

  private whiteouts(now: Map<string, TreeEnt>): string[] {
    const missing = [...this.base.keys()]
      .filter(path => path !== "/" && !now.has(path))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
    const out: string[] = [];
    for (const path of missing) {
      if (!out.some(parent => path.startsWith(`${parent}/`))) out.push(path);
    }
    return out;
  }

  private parts(path: string): string[] {
    const parts = path.split("/").filter(Boolean);
    if (parts.includes("..")) throw new Error(`browser overlay path escapes root: ${path}`);
    return parts;
  }

  private async folder(root: FD, path: string, create: boolean): Promise<FD> {
    let dir = root;
    for (const part of this.parts(path)) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }

  private async dataFile(root: FD, path: string, create: boolean): Promise<FF> {
    const parts = this.parts(path);
    const name = parts.pop();
    if (!name) throw new Error("root is not a regular overlay file");
    const data = await root.getDirectoryHandle("data", { create });
    const dir = await this.folder(data, `/${parts.join("/")}`, create);
    return dir.getFileHandle(name, { create });
  }

  private async readData(root: FD, path: string): Promise<Uint8Array> {
    const file = await (await this.dataFile(root, path, false)).getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  private async writeData(root: FD, path: string, data: Uint8Array): Promise<void> {
    const writer = await (await this.dataFile(root, path, true)).createWritable();
    await writer.write(data);
    await writer.close();
  }

  private async removeData(root: FD, path: string): Promise<void> {
    const parts = this.parts(path);
    const name = parts.pop();
    if (!name) return;
    try {
      const data = await root.getDirectoryHandle("data");
      const dir = await this.folder(data, `/${parts.join("/")}`, false);
      await dir.removeEntry(name);
    } catch { /* The overlay file was already absent. */ }
  }

  private async writeText(root: FD, name: string, value: string): Promise<void> {
    const writer = await (await root.getFileHandle(name, { create: true })).createWritable();
    await writer.write(value);
    await writer.close();
  }

  private async readManifest(root: FD): Promise<OverlayManifest | null> {
    try {
      const file = await (await root.getFileHandle(overlayName)).getFile();
      const value = JSON.parse(await file.text()) as OverlayManifest;
      return value.format === 2 && Array.isArray(value.entries) && Array.isArray(value.whiteouts)
        ? value
        : null;
    } catch (error) {
      if ((error as { name?: string }).name === "NotFoundError") return null;
      throw error;
    }
  }
}
