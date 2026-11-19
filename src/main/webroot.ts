import { parseJson, jsonObject, type Json } from "../core/json.js";
import { hostModule } from "./host-module.js";
import { requireValue } from "../core/err.js";
import { fileSum } from "../fs/tree.js";
import type {
  WebRootEntry,
  WebRootFileEntry,
  WebRootManifest,
} from "./webroot-format.js";

interface HostFs {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  stat(path: string): Promise<{ size: number }>;
}

interface HostPath {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
}

interface HostZlib {
  gzipSync(data: Uint8Array, options: { level: number | null } | null): Uint8Array;
}

interface RootMeta {
  image: number | null;
  ent: Array<Record<string, Json>> | null;
}


const fs = await hostModule("node:fs/promises") as HostFs;
const path = await hostModule("node:path") as HostPath;
const zlib = await hostModule("node:zlib") as HostZlib;
const td = new TextDecoder();

const hex = (bytes: Uint8Array): string =>
  [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");

const num = (value: Json, label: string): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`bad ${label} in root metadata`);
  }
  return Number(value);
};

const text = (value: Json, label: string): string => {
  if (typeof value !== "string") throw new Error(`bad ${label} in root metadata`);
  return value;
};

const lazyCandidate = (paths: readonly string[], size: number): boolean =>
  size >= 256 * 1024 && paths.some(value =>
    value.startsWith("/usr/lib/") ||
    value.startsWith("/usr/libexec/") ||
    value.startsWith("/usr/include/"),
  );

/** Build the immutable browser root from the current CLI root mirror. */
export class WebRootPackage {
  constructor(
    private readonly sourceRoot: string,
    private readonly outputRoot: string,
    private readonly imageVersion: number,
  ) {}

  // Validation precedes mutation so failures leave the current operation in a defined state.
  async build(): Promise<WebRootManifest> {
    const source = path.resolve(this.sourceRoot);
    const output = path.resolve(this.outputRoot);
    const raw = jsonObject(parseJson(td.decode(await fs.readFile(path.join(source, ".thistle-meta.json")))));
    const rawEntries = raw.ent ?? null;
    if (!Array.isArray(rawEntries)) throw new Error("CLI root metadata has no entry table");

    const rows = rawEntries.map(item => {
      const value = jsonObject(item);
      const p = text((value.p ?? null), "path");
      const k = text((value.k ?? null), "kind");
      if (!p.startsWith("/") || p.split("/").includes("..") || !["d", "f", "l"].includes(k)) {
        throw new Error(`bad CLI root entry ${p}`);
      }
      return {
        p,
        k: k as "d" | "f" | "l",
        id: num((value.id ?? null), "inode"),
        mode: num((value.mode ?? null), "mode"),
        uid: num((value.uid ?? null), "uid"),
        gid: num((value.gid ?? null), "gid"),
        at: num((value.at ?? null), "atime"),
        mt: num((value.mt ?? null), "mtime"),
        ct: num((value.ct ?? null), "ctime"),
        ...(k === "l" ? { to: text((value.to ?? null), "link target") } : {}),
      };
    }).filter(value => value.p !== "/.thistle-meta.json");

    const filePaths = new Map<number, string[]>();
    for (const row of rows) {
      if (row.k !== "f") continue;
      const list = filePaths.get(row.id) ?? [];
      list.push(row.p);
      filePaths.set(row.id, list);
    }

    await fs.rm(output, { recursive: true, force: true });
    await fs.mkdir(path.join(output, "blob"), { recursive: true });

    const coreParts: Uint8Array[] = [];
    const refs = new Map<number, Pick<WebRootFileEntry, "size" | "sum" | "head" | "ref">>();
    let coreSize = 0;

    for (const [id, paths] of [...filePaths].sort(([a], [b]) => a - b)) {
      const hostPath = path.join(source, requireValue(paths[0] ?? null, "src/main/webroot.ts:108").slice(1));
      const bytes = Uint8Array.from(await fs.readFile(hostPath));
      const size = bytes.length;
      const sum = fileSum(bytes);
      const head = hex(bytes.slice(0, 64));

      if (lazyCandidate(paths, size)) {
        const blobPath = `blob/${id}.gz`;
        await fs.writeFile(path.join(output, blobPath), Uint8Array.from(zlib.gzipSync(bytes, { level: 1 })));
        refs.set(id, { size, sum, head, ref: { kind: "blob", path: blobPath } });
      } else {
        const offset = coreSize;
        coreParts.push(bytes);
        coreSize += size;
        refs.set(id, { size, sum, head, ref: { kind: "core", offset, length: size } });
      }
    }

    const core = new Uint8Array(coreSize);
    let offset = 0;
    for (const part of coreParts) {
      core.set(part, offset);
      offset += part.length;
    }
    const packedCore = Uint8Array.from(zlib.gzipSync(core, { level: 1 }));
    await fs.writeFile(path.join(output, "core.gz"), packedCore);

    const entries: WebRootEntry[] = rows.map(row => {
      const base = {
        p: row.p,
        id: row.id,
        mode: row.mode,
        uid: row.uid,
        gid: row.gid,
        at: row.at,
        mt: row.mt,
        ct: row.ct,
      };
      if (row.k === "d") return { ...base, k: "d" };
      if (row.k === "l") return { ...base, k: "l", to: requireValue(row.to ?? null, "src/main/webroot.ts:147") };
      const ref = (refs.get(row.id) ?? null);
      if (!ref) throw new Error(`missing CLI root payload for ${row.p}`);
      return { ...base, k: "f", ...ref };
    });

    const manifest: WebRootManifest = {
      format: 1,
      image: this.imageVersion,
      generated: new Date().toISOString(),
      core: {
        path: "core.gz",
        encoding: "gzip",
        packedSize: packedCore.length,
        unpackedSize: core.length,
      },
      entries,
    };

    await fs.writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    return manifest;
  }
}
