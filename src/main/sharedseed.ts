import { DirTree } from "./dir.js";
import { fileSum } from "../fs/tree.js";
import type { TreeEnt } from "../fs/tree.js";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const encode = (bytes: Uint8Array): string => {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const value = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    output += alphabet[(value >>> 18) & 63];
    output += alphabet[(value >>> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return output;
};

const persistent = (path: string): boolean =>
  !["/dev", "/proc", "/sys", "/run", "/tmp"].some(root => path === root || path.startsWith(`${root}/`));

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(",")}}`;
};

const checksum = (value: unknown): string => {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(canonical(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const sharedSeedSnapshot = async (root: string | URL, imageGeneration: number): Promise<object | null> => {
  const source = await new DirTree(root).pull();
  if (!source) return null;
  const persistentEntries = source.filter(item => persistent(item.p));
  const links = new Map<number, number>();
  for (const item of persistentEntries) links.set(item.id, (links.get(item.id) ?? 0) + 1);
  const entries = persistentEntries.map(item => ({
    path: item.p,
    inode: String(item.id),
    kind: item.k === "d" ? "directory" as const : item.k === "f" ? "file" as const : "symlink" as const,
    mode: item.mode,
    uid: item.uid,
    gid: item.gid,
    atimeMs: item.at,
    mtimeMs: item.mt,
    ctimeMs: item.ct,
    version: 1,
    nlink: links.get(item.id) ?? 1,
    ...(item.k === "f" ? {
      size: item.data?.length ?? item.size ?? 0,
      checksum: item.sum ?? fileSum(item.data ?? new Uint8Array()),
      data: encode(item.data ?? new Uint8Array()),
    } : {}),
    ...(item.k === "l" ? { target: item.to ?? "" } : {}),
  }));
  const payload = {
    schema: 1 as const,
    filesystemId: `mikuos-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    generation: 1,
    imageGeneration,
    committedAt: new Date().toISOString(),
    entries,
  };
  return { ...payload, checksum: checksum(payload) };
};
