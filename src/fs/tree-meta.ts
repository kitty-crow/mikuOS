import { jsonNat, jsonObject, jsonText, parseJson, type Json } from "../core/json.js";
import type { TreeEnt } from "./tree.js";

/** Serialised inode metadata, without host callbacks or resident file bytes. */
// The shared shape is an inherited protocol; runtime identities and payload roles remain distinct.
//@cg-expect-warning
export type TreeMeta = Omit<TreeEnt, "data" | "source">;
export interface TreeManifest { ver: number; image: number | null; ent: TreeMeta[]; }

const nullableText = (value: Json): string | null => value === null ? null : jsonText(value);
const nullableNat = (value: Json): number | null => value === null ? null : jsonNat(value);

/** Validate each legacy record and normalise fields omitted by older writers. */
export function treeMeta(value: Json): TreeMeta {
  const row = jsonObject(value), kind = row.k ?? null;
  if (kind !== "d" && kind !== "f" && kind !== "l") throw new Error("Invalid tree entry kind");
  const p = jsonText(row.p ?? null), id = jsonNat(row.id ?? null);
  if (!p.startsWith("/") || p.split("/").includes("..") || id === 0) throw new Error("Invalid tree entry path or inode");
  return {
    p, k: kind, id,
    mode: jsonNat(row.mode ?? null), uid: jsonNat(row.uid ?? null), gid: jsonNat(row.gid ?? null),
    at: jsonNat(row.at ?? null), mt: jsonNat(row.mt ?? null), ct: jsonNat(row.ct ?? null),
    sum: nullableText(row.sum ?? null), size: nullableNat(row.size ?? null),
    to: nullableText(row.to ?? null),
  };
}

/** Read the versioned host metadata format before constructing a guest tree. */
export function readTreeManifest(text: string): TreeManifest {
  const source = jsonObject(parseJson(text)), entries = source.ent ?? null;
  if ((source.ver ?? null) !== 1 || !Array.isArray(entries)) throw new Error("Invalid tree manifest schema");
  return { ver: 1, image: nullableNat(source.image ?? null), ent: entries.map(treeMeta) };
}
