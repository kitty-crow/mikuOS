import { jsonNat, jsonObject, jsonText, parseJson, type Json } from "../core/json.js";
import { treeMeta } from "../fs/tree-meta.js";

export interface WebRootBaseEntry {
  p: string;
  k: "d" | "f" | "l";
  id: number;
  mode: number;
  uid: number;
  gid: number;
  at: number;
  mt: number;
  ct: number;
}

export interface WebRootDirectoryEntry extends WebRootBaseEntry {
  k: "d";
}

export interface WebRootLinkEntry extends WebRootBaseEntry {
  k: "l";
  to: string;
}

export interface WebRootCoreRef {
  kind: "core";
  offset: number;
  length: number;
}

export interface WebRootBlobRef {
  kind: "blob";
  path: string;
}

export interface WebRootFileEntry extends WebRootBaseEntry {
  k: "f";
  size: number;
  sum: string;
  head: string;
  ref: WebRootCoreRef | WebRootBlobRef;
}

export type WebRootEntry =
  | WebRootDirectoryEntry
  | WebRootLinkEntry
  | WebRootFileEntry;

export interface WebRootManifest {
  format: 1;
  image: number;
  generated: string;
  core: {
    path: string;
    encoding: "gzip";
    packedSize: number;
    unpackedSize: number;
  };
  entries: WebRootEntry[];
}

const webEntry = (value: Json): WebRootEntry => {
  const raw = jsonObject(value), meta = treeMeta(value);
  switch (meta.k) {
    case "d": return { ...meta, k: "d" };
    case "l": return { ...meta, k: "l", to: jsonText(raw.to ?? null) };
    case "f": {
      const ref = jsonObject(raw.ref ?? null), kind = ref.kind ?? null;
      if (kind !== "core" && kind !== "blob") throw new Error("Invalid web-root file reference");
      return {
        ...meta, k: "f", size: jsonNat(raw.size ?? null),
        sum: jsonText(raw.sum ?? null), head: jsonText(raw.head ?? null),
        ref: kind === "core"
          ? { kind, offset: jsonNat(ref.offset ?? null), length: jsonNat(ref.length ?? null) }
          : { kind, path: jsonText(ref.path ?? null) },
      };
    }
  }
};

/** Decode the immutable browser root before trusting offsets or lazy blob paths. */
export function readWebRoot(text: string): WebRootManifest {
  const raw = jsonObject(parseJson(text)), entries = raw.entries ?? null;
  const core = jsonObject(raw.core ?? null);
  if ((raw.format ?? null) !== 1 || (core.encoding ?? null) !== "gzip" || !Array.isArray(entries)) throw new Error("Invalid web-root schema");
  return {
    format: 1, image: jsonNat(raw.image ?? null), generated: jsonText(raw.generated ?? null),
    core: { path: jsonText(core.path ?? null), encoding: "gzip", packedSize: jsonNat(core.packedSize ?? null), unpackedSize: jsonNat(core.unpackedSize ?? null) },
    entries: entries.map(webEntry),
  };
}
