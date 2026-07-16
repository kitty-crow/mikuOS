import type { TreeEnt } from "../fs/tree.js";
import {
  TETO_VFS_DATA_CAPACITY,
  TETO_VFS_DENTRY_CAPACITY,
  TETO_VFS_IMAGE_MAGIC,
  TETO_VFS_IMAGE_VERSION,
  TETO_VFS_INODE_CAPACITY,
  TETO_VFS_KIND_DIRECTORY,
  TETO_VFS_KIND_FILE,
  TETO_VFS_KIND_LINK,
} from "./abi.js";

const HEADER_SIZE = 32;
const INODE_RECORD_SIZE = 56;
const DENTRY_RECORD_SIZE = 16;
const encoder = new TextEncoder();

interface InodeImage {
  entry: TreeEnt;
  payload: Uint8Array;
  nlink: number;
}

const align4 = (value: number): number => (value + 3) & ~3;

const checkedU32 = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new Error(`invalid Teto VFS ${label}`);
  return value;
};

const checkedTime = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid Teto VFS ${label}`);
  return value;
};

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const kind = (entry: TreeEnt): number => {
  if (entry.k === "f") return TETO_VFS_KIND_FILE;
  if (entry.k === "d") return TETO_VFS_KIND_DIRECTORY;
  if (entry.k === "l") return TETO_VFS_KIND_LINK;
  throw new Error(`unsupported Teto VFS node kind at ${entry.p}`);
};

const payload = (entry: TreeEnt): Uint8Array => {
  if (entry.k === "f") {
    if (!(entry.data instanceof Uint8Array)) throw new Error(`missing Teto VFS file data at ${entry.p}`);
    return entry.data;
  }
  if (entry.k === "l") {
    if (typeof entry.to !== "string") throw new Error(`missing Teto VFS link target at ${entry.p}`);
    return encoder.encode(entry.to);
  }
  return new Uint8Array();
};

const validPath = (path: string): boolean => {
  if (path === "/") return true;
  if (!path.startsWith("/") || path.endsWith("/") || path.includes("//")) return false;
  return path.slice(1).split("/").every(part => part !== "" && part !== "." && part !== ".." && !part.includes("\0"));
};

const parentPath = (path: string): string => {
  const split = path.lastIndexOf("/");
  return split === 0 ? "/" : path.slice(0, split);
};

const fnv = (bytes: Uint8Array, from: number): number => {
  let hash = 0x811c9dc5;
  for (let index = from; index < bytes.length; index++) hash = Math.imul(hash ^ bytes[index]!, 0x01000193);
  return hash >>> 0;
};

/** Deterministic, allocation-bounded root image consumed by the generated Teto kernel. */
export const serializeTetoVfs = (source: readonly TreeEnt[]): Uint8Array => {
  const entries = [...source].sort((left, right) => left.p < right.p ? -1 : left.p > right.p ? 1 : 0);
  const paths = new Map<string, TreeEnt>();
  const links = new Map<number, number>();
  const inodes = new Map<number, InodeImage>();

  for (const entry of entries) {
    if (!validPath(entry.p) || paths.has(entry.p)) throw new Error(`invalid or duplicate Teto VFS path ${entry.p}`);
    checkedU32(entry.id, `inode at ${entry.p}`);
    if (entry.id === 0 || entry.id >= TETO_VFS_INODE_CAPACITY) throw new Error(`Teto VFS inode is outside the kernel table at ${entry.p}`);
    checkedU32(entry.mode, `mode at ${entry.p}`);
    checkedU32(entry.uid, `uid at ${entry.p}`);
    checkedU32(entry.gid, `gid at ${entry.p}`);
    checkedTime(entry.at, `atime at ${entry.p}`);
    checkedTime(entry.mt, `mtime at ${entry.p}`);
    checkedTime(entry.ct, `ctime at ${entry.p}`);
    const bytes = payload(entry);
    const previous = inodes.get(entry.id);
    if (previous) {
      const original = previous.entry;
      if (original.k !== entry.k || original.mode !== entry.mode || original.uid !== entry.uid || original.gid !== entry.gid ||
          original.at !== entry.at || original.mt !== entry.mt || original.ct !== entry.ct || !sameBytes(previous.payload, bytes)) {
        throw new Error(`inconsistent Teto VFS hard-link metadata at ${entry.p}`);
      }
    } else {
      inodes.set(entry.id, { entry, payload: bytes, nlink: 0 });
    }
    paths.set(entry.p, entry);
    links.set(entry.id, (links.get(entry.id) ?? 0) + 1);
  }

  const root = paths.get("/");
  if (!root || root.k !== "d") throw new Error("Teto VFS image requires one directory root");
  if (inodes.size === 0 || inodes.size >= TETO_VFS_INODE_CAPACITY) throw new Error("Teto VFS inode table is full");
  if (entries.length - 1 > TETO_VFS_DENTRY_CAPACITY) throw new Error("Teto VFS dentry table is full");

  let imageSize = HEADER_SIZE;
  let dataSize = 0;
  const inodeImages = [...inodes.values()].sort((left, right) => left.entry.id - right.entry.id);
  for (const inode of inodeImages) {
    inode.nlink = links.get(inode.entry.id) ?? 0;
    if (inode.entry.k === "d" && inode.nlink !== 1) throw new Error(`Teto VFS directory has multiple parents at ${inode.entry.p}`);
    imageSize += align4(INODE_RECORD_SIZE + inode.payload.length);
    dataSize += align4(inode.payload.length);
  }

  const dentries = entries.filter(entry => entry.p !== "/").map(entry => {
    const parent = paths.get(parentPath(entry.p));
    if (!parent || parent.k !== "d") throw new Error(`missing Teto VFS parent directory for ${entry.p}`);
    const name = encoder.encode(entry.p.slice(entry.p.lastIndexOf("/") + 1));
    if (name.length === 0 || name.length > 255 || name.some(value => value === 0 || value === 47)) {
      throw new Error(`invalid Teto VFS name at ${entry.p}`);
    }
    imageSize += align4(DENTRY_RECORD_SIZE + name.length);
    dataSize += align4(name.length);
    return { entry, parent, name };
  });
  if (dataSize > TETO_VFS_DATA_CAPACITY || imageSize > 0xffffffff) throw new Error("Teto VFS image exceeds the kernel data arena");

  const output = new Uint8Array(imageSize);
  const view = new DataView(output.buffer);
  view.setUint32(0, TETO_VFS_IMAGE_MAGIC, true);
  view.setUint32(4, TETO_VFS_IMAGE_VERSION, true);
  view.setUint32(8, inodeImages.length, true);
  view.setUint32(12, dentries.length, true);
  view.setUint32(16, root.id, true);
  view.setUint32(20, output.length, true);
  let at = HEADER_SIZE;
  for (const inode of inodeImages) {
    const entry = inode.entry;
    view.setUint32(at, entry.id, true);
    view.setUint32(at + 4, kind(entry), true);
    view.setUint32(at + 8, entry.mode, true);
    view.setUint32(at + 12, entry.uid, true);
    view.setUint32(at + 16, entry.gid, true);
    view.setUint32(at + 20, inode.nlink, true);
    view.setUint32(at + 24, inode.payload.length, true);
    view.setBigUint64(at + 32, BigInt(entry.at), true);
    view.setBigUint64(at + 40, BigInt(entry.mt), true);
    view.setBigUint64(at + 48, BigInt(entry.ct), true);
    output.set(inode.payload, at + INODE_RECORD_SIZE);
    at += align4(INODE_RECORD_SIZE + inode.payload.length);
  }
  for (const dentry of dentries) {
    view.setUint32(at, dentry.parent.id, true);
    view.setUint32(at + 4, dentry.entry.id, true);
    view.setUint32(at + 8, dentry.name.length, true);
    output.set(dentry.name, at + DENTRY_RECORD_SIZE);
    at += align4(DENTRY_RECORD_SIZE + dentry.name.length);
  }
  if (at !== output.length) throw new Error("Teto VFS serializer size mismatch");
  view.setUint32(24, fnv(output, HEADER_SIZE), true);
  return output;
};
