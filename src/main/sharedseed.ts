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

const checksum = (entries: unknown): string => {
  let value = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(JSON.stringify(entries))) {
    value ^= byte;
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
};

const entry = (source: TreeEnt) => ({
  path: source.p,
  inode: String(source.id),
  kind: source.k === "d" ? "directory" as const : source.k === "f" ? "file" as const : "symlink" as const,
  mode: source.mode,
  uid: source.uid,
  gid: source.gid,
  atimeMs: source.at,
  mtimeMs: source.mt,
  ctimeMs: source.ct,
  version: 1,
  nlink: 1,
  ...(source.k === "f" ? {
    size: source.data?.length ?? source.size ?? 0,
    checksum: source.sum ?? fileSum(source.data ?? new Uint8Array()),
    data: encode(source.data ?? new Uint8Array()),
  } : {}),
  ...(source.k === "l" ? { target: source.to ?? "" } : {}),
});

export const sharedSeedSnapshot = async (root: string | URL, imageGeneration: number): Promise<object | null> => {
  const entries = await new DirTree(root).pull();
  if (!entries) return null;
  const converted = entries.filter(item => persistent(item.p)).map(entry);
  const payload = {
    schema: 1 as const,
    filesystemId: `mikuos-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    generation: 1,
    imageGeneration,
    committedAt: new Date().toISOString(),
    entries: converted,
  };
  return { ...payload, checksum: checksum(payload) };
};
