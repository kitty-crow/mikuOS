import { ensure } from "../core/err.js";
import { readWebRoot } from "./webroot-format.js";
import { treeMeta } from "../fs/tree-meta.js";
import { jsonObject, jsonText, jsonNat, parseJson } from "../core/json.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
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
  entries(): AsyncIterable<[string, FH], void, void>;
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<FD>;
  getFileHandle(name: string, options: { create: boolean }): Promise<FF>;
  removeEntry(name: string, options: { recursive: boolean }): Promise<void>;
}
interface Nav { storage: { getDirectory(): Promise<FD> } | null; }
interface Pick { showDirectoryPicker: (() => Promise<FD>) | null; }

// The shared shape is an inherited protocol; runtime identities and payload roles remain distinct.
//@cg-expect-warning
interface OverlayMeta extends Omit<TreeEnt, "data" | "source"> {
  base: boolean | null;
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

const inflate = async (
  url: URL,
  progress: ((done: number, total: number) => void) | null = null,
): Promise<Uint8Array> => {
  const response = await fetchOk(url);
  if (!response.body) throw new Error(`${url.pathname}: empty compressed response`);
  const size = Number(response.headers.get("content-length"));
  const measurable = Number.isSafeInteger(size) && size > 0;
  let loaded = 0;
  const compressed = measurable && progress
    ? response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          loaded += chunk.byteLength;
          progress(Math.min(loaded, size), size);
          controller.enqueue(chunk);
        },
      }))
    : response.body;
  // The DOM typing also accepts ArrayBuffer for the decompressor's writable
  // side, but this stream supplies only Uint8Array chunks.
  const decoder = new DecompressionStream("gzip") as
    ReadableWritablePair<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBufferLike>>;
  const stream = compressed.pipeThrough(decoder);
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const fileMeta = (entry: TreeEnt): { size: number; sum: string } => {
  const data = entry.data;
  return {
    size: entry.size ?? withValue(entry.source ?? null, value => value.size) ?? withValue(data ?? null, value => value.length) ?? 0,
    sum: entry.sum ?? withValue(entry.source ?? null, value => value.sum) ?? fileSum(data ?? new Uint8Array()),
  };
};

const metadata = (entry: TreeEnt): OverlayMeta => ({"base": null, p: entry.p,
  k: entry.k,
  id: entry.id,
  mode: entry.mode,
  uid: entry.uid,
  gid: entry.gid,
  at: entry.at,
  mt: entry.mt,
  ct: entry.ct,
  ...fileMeta(entry),
  to: entry.k === "l" ? entry.to : null,
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

  constructor(
    base: string | URL = new URL("./root/", document.baseURI),
    persistence = true,
    private readonly onBootProgress: ((phase: number, done: number | null, total: number | null) => void) | null = null,
  ) {
    const root = base instanceof URL ? base : new URL(base, document.baseURI);
    this.manifestUrl = new URL("manifest.json", root);
    const nav: Nav = navigator as Navigator & Nav;
    const storage = nav.storage;
    this.persistent = persistence && !!withValue(storage ?? null, value => value.getDirectory);
    this.root = this.persistent
      ? requireValue(storage ?? null, "src/main/webtree.ts:149").getDirectory().then(dir => dir.getDirectoryHandle(".mikuos", { create: true }))
      : Promise.resolve(null);
    this.basePromise = this.loadBase();
  }

  get label(): string { return this.persistent ? `${this.name} + OPFS overlay` : this.name; }
  get imageVersion(): number { return this.image; }

  async pick(): Promise<boolean> {
    const fn = ((globalThis as typeof globalThis & Pick).showDirectoryPicker ?? null);
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
      const current = (this.base.get(entry.p) ?? null);
      if (entry.k === "f") {
        // Overlay changes preserve the selected base inode and its stored payload identity.
        //@cg-expect-warning
        if (entry.base) {
          ensure(!(!current || current.k !== "f"), () => { throw new Error(`missing static base file ${entry.p}`); });
          const mergedEntry: TreeEnt = { ...current, ...entry };
          (current.data) && (mergedEntry.data = current.data);
          (current.source) && (mergedEntry.source = current.source);
          merged.set(entry.p, mergedEntry);
        } else {
          const data = await this.readData(root, entry.p);
          merged.set(entry.p, {"source": null, ...entry, data, sum: entry.sum ?? fileSum(data), size: data.length });
        }
      } else {
        merged.set(entry.p, { ...entry, data: null, source: null });
      }
    }

    this.image = overlay.image;
    return [...merged.values()].sort((a, b) =>
      a.p.split("/").length - b.p.split("/").length || a.p.localeCompare(b.p),
    );
  }

  /**
   * TreeFs.dump() numbers its inodes afresh on each snapshot. Those local
   * numbers cannot be written into the overlay: they may collide with
   * unrelated immutable image entries when the tree is restored.
   *
   * Keep base inode IDs for pre-existing paths and allocate overlay-only
   * IDs above both the immutable base and earlier overlay records.
   * Every link sharing one snapshot inode receives the same stable ID.
   */
  private stableInodeIds(entries: TreeEnt[]): Map<number, number> {
    const assigned = new Map<number, number>();
    const used = new Set<number>();
    const oldOverlay = new Map((withValue(this.overlay ?? null, value => value.entries) ?? []).map(entry => [entry.p, entry]));
    let nextId = Math.max(0, ...this.baseEntries.map(entry => entry.id),
      ...(withValue(this.overlay ?? null, value => value.entries) ?? []).map(entry => entry.id));

    const oldPaths = entries.filter(entry =>
      this.base.has(entry.p) || oldOverlay.has(entry.p));
    const candidates = [...oldPaths, ...entries];

    for (const entry of candidates) {
      if (assigned.has(entry.id)) continue;

      const base = (this.base.get(entry.p) ?? null);
      const saved = (oldOverlay.get(entry.p) ?? null);
      const candidate = withValue(base ?? null, value => value.k) === entry.k ? requireValue(base ?? null, "src/main/webtree.ts:239").id
        : withValue(saved ?? null, value => value.k) === entry.k ? requireValue(saved ?? null, "src/main/webtree.ts:240").id
        : null;
      const id = candidate !== null && !used.has(candidate)
        ? candidate
        : ++nextId;
      assigned.set(entry.id, id);
      used.add(id);
    }

    return assigned;
  }

  async push(entries: TreeEnt[], imageVersion: number | null = this.image): Promise<void> {
    imageVersion ??= this.image;
    await this.basePromise;
    const root = await this.root;
    if (!root) return;

    const now = new Map(entries.map(entry => [entry.p, entry]));
    const whiteouts = this.whiteouts(now);
    const changed: OverlayMeta[] = [];
    const inodeIds = this.stableInodeIds(entries);

    for (const entry of entries) {
      const original = (this.base.get(entry.p) ?? null);
      if (original && sameBase(entry, original)) continue;

      const out = metadata(entry);
      out.id = inodeIds.get(entry.id) ?? entry.id;
      if (entry.k === "f") {
        // Overlay changes preserve the selected base inode and its stored payload identity.
        //@cg-expect-warning
        if (original && baseContent(entry, original)) {
          out.base = true;
        } else {
          ensure((entry.data instanceof Uint8Array), () => { throw new Error(`modified web-root file has no resident payload: ${entry.p}`); });
          await this.writeData(root, entry.p, entry.data);
        }
      }
      changed.push(out);
    }

    const nextData = new Set(changed.filter(entry => entry.k === "f" && !entry.base).map(entry => entry.p));
    for (const entry of withValue(this.overlay ?? null, value => value.entries) ?? []) {
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
    const manifest = readWebRoot(await (await fetchOk(this.manifestUrl)).text());
    if (manifest.format !== 1 || !Array.isArray(manifest.entries)) throw new Error("unsupported static web-root manifest");
    withValue(this.onBootProgress ?? null, callable => callable.call(this, 2, null, null));
    const core = await inflate(new URL(manifest.core.path, this.manifestUrl),
      (done, total) => withValue(this.onBootProgress ?? null, callable => callable.call(this, 2, done, total)));
    if (core.length !== manifest.core.unpackedSize) throw new Error("static web-root core size mismatch");
    withValue(this.onBootProgress ?? null, callable => callable.call(this, 3, null, null));

    const entries = manifest.entries.map(entry => this.baseEntry(entry, core));
    this.baseEntries = entries;
    this.base = new Map(entries.map(entry => [entry.p, entry]));
    this.image = manifest.image;
    return entries;
  }

  private baseEntry(entry: WebRootEntry, core: Uint8Array): TreeEnt {
    if (entry.k === "d") return {"data": null, "sum": null, "size": null, "source": null, "to": null, ...entry };
    if (entry.k === "l") return {"data": null, "sum": null, "size": null, "source": null, ...entry };
    const file = entry as WebRootFileEntry;
    if (file.ref.kind === "core") {
      const data = core.subarray(file.ref.offset, file.ref.offset + file.ref.length);
      ensure(!(data.length !== file.size || fileSum(data) !== file.sum), () => { throw new Error(`bad static web-root core entry ${file.p}`); });
      return {"source": null, "to": null, ...file, data, size: file.size, sum: file.sum };
    }

    const url = new URL(file.ref.path, this.manifestUrl);
    const source: RegSource = {
      size: file.size,
      sum: file.sum,
      head: fromHex(file.head),
      load: async () => {
        const data = await inflate(url, null);
        if (data.length !== file.size || fileSum(data) !== file.sum) throw new Error(`bad static web-root blob ${file.p}`);
        return data;
      },
    };
    return {"data": null, "to": null, ...file, source, size: file.size, sum: file.sum };
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
    for (const part of this.parts(path)) {
      try {
        dir = await dir.getDirectoryHandle(part, { create });
      } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
        if (!create || !isTypeMismatch(error)) throw error;
        // The current guest tree now needs a directory where an old overlay file remains.
        await dir.removeEntry(part, { recursive: false });
        dir = await dir.getDirectoryHandle(part, { create: true });
      }
    }
    return dir;
  }



  private async dataFile(root: FD, path: string, create: boolean): Promise<FF> {
    const parts = this.parts(path);
    const name = (parts.pop() ?? null);
    if (!name) throw new Error("root is not a regular overlay file");
    const data = await this.folder(root, "/data", create);
    const dir = await this.folder(data, `/${parts.join("/")}`, create);
    try {
      return await dir.getFileHandle(name, { create });
    } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      if (!create || !isTypeMismatch(error)) throw error;
      // A directory used to occupy this file path. The new guest snapshot
      // cannot contain its descendants, so its stale overlay can be discarded.
      await dir.removeEntry(name, { recursive: true });
      return dir.getFileHandle(name, { create: true });
    }
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
    const name = (parts.pop() ?? null);
    if (!name) return;
    try {
      const data = await root.getDirectoryHandle("data", { create: false });
      const dir = await this.folder(data, `/${parts.join("/")}`, false);
      await dir.removeEntry(name, { recursive: false });
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
    } catch { /* The overlay file was already absent. */ }
  }

  private async writeText(root: FD, name: string, value: string): Promise<void> {
    const writer = await (await root.getFileHandle(name, { create: true })).createWritable();
    await writer.write(value);
    await writer.close();
  }

  // This method is retained as the established snapshot, executable or platform callback boundary.
  //@cg-expect-warning
  private async readManifest(root: FD): Promise<OverlayManifest | null> {
    try {
      const file = await (await root.getFileHandle(overlayName, { create: false })).getFile();
      const value = jsonObject(parseJson(await file.text()));
      const entries = value.entries ?? null, whiteouts = value.whiteouts ?? null;
      if ((value.format ?? null) !== 2 || !Array.isArray(entries) || !Array.isArray(whiteouts)) return null;
      return { format: 2, image: jsonNat(value.image ?? null), whiteouts: whiteouts.map(jsonText),
        entries: entries.map(item => ({ ...treeMeta(item), base: (jsonObject(item).base ?? null) === true })) };

    } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      if ((error as { name: string | null }).name === "NotFoundError") return null;
      throw error;
    }
  }
}

function isTypeMismatch(error: Error): boolean { return error.name === "TypeMismatchError"; }
