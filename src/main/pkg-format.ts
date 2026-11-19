import { jsonNat, jsonObject, jsonText, parseJson, type Json } from "../core/json.js";
import { treeMeta, type TreeMeta } from "../fs/tree-meta.js";

// The shared shape is an inherited protocol; runtime identities and payload roles remain distinct.
//@cg-expect-warning
export type PackageEntry = Omit<TreeMeta, "size"> & { off: number | null; len: number | null };
export interface PackageManifest { schema: number; release: string; ent: PackageEntry[]; }

const position = (value: Json): number | null => value === null ? null : jsonNat(value);

/** Validate package metadata independently of the payload bounds and checksum. */
export function readPackage(text: string): PackageManifest {
  const value = jsonObject(parseJson(text)), entries = value.ent ?? null;
  if ((value.schema ?? null) !== 1 || !Array.isArray(entries)) throw new Error("Invalid root package schema");
  return { schema: 1, release: jsonText(value.release ?? null), ent: entries.map(item => {
    const raw = jsonObject(item), meta = treeMeta(item);
    return { ...meta, off: position(raw.off ?? null), len: position(raw.len ?? null) };
  }) };
}
