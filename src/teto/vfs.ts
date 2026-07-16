import {
  C_IMAGE_LOCK,
  C_IMAGE_SIZE,
  C_IMAGE_TOP,
  C_PROCESS_CAPACITY,
  C_PROCESS_TABLE_BASE,
  C_VFS_DATA_BASE,
  C_VFS_DATA_END,
  C_VFS_DATA_NEXT,
  C_VFS_DENTRY_BASE,
  C_VFS_DENTRY_CAPACITY,
  C_VFS_DENTRY_COUNT,
  C_VFS_DIRTY,
  C_VFS_GENERATION,
  C_VFS_INODE_BASE,
  C_VFS_INODE_CAPACITY,
  C_VFS_INODE_COUNT,
  C_VFS_LOADED,
  C_VFS_ROOT,
  D_FLAGS,
  D_INODE,
  D_NAME,
  D_NAME_HASH,
  D_NAME_LENGTH,
  D_PARENT,
  TETO_CONTROL_BASE,
  TETO_VFS_CAPACITY_ERROR,
  TETO_VFS_CHECKSUM,
  TETO_VFS_DATA_CAPACITY,
  TETO_VFS_DENTRY_CAPACITY,
  TETO_VFS_DENTRY_STRIDE,
  TETO_VFS_DUPLICATE,
  TETO_VFS_FORMAT,
  TETO_VFS_IMAGE_MAGIC,
  TETO_VFS_IMAGE_VERSION,
  TETO_VFS_INODE_CAPACITY,
  TETO_VFS_INODE_STRIDE,
  TETO_VFS_KIND_DIRECTORY,
  TETO_VFS_KIND_EMPTY,
  TETO_VFS_KIND_FILE,
  TETO_VFS_KIND_LINK,
  TETO_VFS_OK,
  TETO_VFS_RANGE,
  P_FSGID,
  P_FSUID,
  P_CWD_INODE,
  P_GROUP_COUNT,
  P_GROUPS,
  P_STATE,
  TETO_PROCESS_EMPTY,
  TETO_PROCESS_STRIDE,
  V_ATIME,
  V_CAPACITY,
  V_CTIME,
  V_DATA,
  V_FLAGS,
  V_GID,
  V_KIND,
  V_MODE,
  V_MTIME,
  V_NLINK,
  V_SIZE,
  V_UID,
} from "./abi.js";
import {
  atomicLoadI32,
  atomicLoadU64,
  atomicStoreU64,
  copyMemory,
  fill,
  loadU8,
  loadU32,
  loadU64,
  memorySize as memorySizeOf,
  storeU32,
  storeU64,
} from "./memory.js";
import type { TetoMemory } from "./memory.js";
import type { I32, Ptr, U32, U64 } from "./types.js";
import { mulU32, ux, word, wordToI32, wordToU32 } from "./word.js";

const VFS_HEADER_SIZE: U32 = 32;
const VFS_INODE_IMAGE_SIZE: U32 = 56;
const VFS_DENTRY_IMAGE_SIZE: U32 = 16;

const inputContains = (memory: TetoMemory, at: Ptr, size: U32): boolean => {
  if (atomicLoadI32(memory, TETO_CONTROL_BASE + C_IMAGE_LOCK) !== 1) return false;
  const start = loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP);
  const length = loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_SIZE);
  return at >= start && at - start <= length && size <= length - (at - start);
};

const memoryContains = (memory: TetoMemory, at: Ptr, size: U32): boolean => {
  const total = memorySizeOf(memory);
  return at <= total && size <= total - at;
};

const inodeAt = (memory: TetoMemory, inode: U32): Ptr =>
  loadU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_BASE) + inode * TETO_VFS_INODE_STRIDE;

const dentryAt = (memory: TetoMemory, index: U32): Ptr =>
  loadU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_BASE) + index * TETO_VFS_DENTRY_STRIDE;

const align4 = (value: U32): U32 => (value + 3) & -4;

const hashBytes = (memory: TetoMemory, at: Ptr, size: U32): U32 => {
  let hash: U32 = 0x811c9dc5;
  let index: U32 = 0;
  while (index < size) {
    hash = mulU32(hash ^ loadU8(memory, at + index), 0x01000193);
    index += 1;
  }
  return hash;
};

const allocateData = (memory: TetoMemory, size: U32): Ptr => {
  if (size === 0) return 0;
  const aligned = align4(size);
  if (aligned < size) return 0xffffffff;
  const next = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_NEXT);
  const end = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_END);
  if (next > end || aligned > end - next) return 0xffffffff;
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_NEXT, next + aligned);
  return next;
};

const validName = (memory: TetoMemory, at: Ptr, size: U32): boolean => {
  if (size === 0 || size > 255) return false;
  let index: U32 = 0;
  while (index < size) {
    const value = loadU8(memory, at + index);
    if (value === 0 || value === 47) return false;
    index += 1;
  }
  if (size === 1 && loadU8(memory, at) === 46) return false;
  if (size === 2 && loadU8(memory, at) === 46 && loadU8(memory, at + 1) === 46) return false;
  return true;
};

const sameName = (memory: TetoMemory, dentry: Ptr, at: Ptr, size: U32, hash: U32): boolean => {
  if (loadU32(memory, dentry + D_NAME_LENGTH) !== size || loadU32(memory, dentry + D_NAME_HASH) !== hash) return false;
  const stored = loadU32(memory, dentry + D_NAME);
  let index: U32 = 0;
  while (index < size) {
    if (loadU8(memory, stored + index) !== loadU8(memory, at + index)) return false;
    index += 1;
  }
  return true;
};

const findChild = (memory: TetoMemory, parent: U32, name: Ptr, nameLength: U32): U32 => {
  if (!validName(memory, name, nameLength)) return 0;
  const hash = hashBytes(memory, name, nameLength);
  const count = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_COUNT);
  let index: U32 = 0;
  while (index < count) {
    const dentry = dentryAt(memory, index);
    if (loadU32(memory, dentry + D_PARENT) === parent && sameName(memory, dentry, name, nameLength, hash)) {
      return loadU32(memory, dentry + D_INODE);
    }
    index += 1;
  }
  return 0;
};

const parentOf = (memory: TetoMemory, inode: U32): U32 => {
  const root = loadU32(memory, TETO_CONTROL_BASE + C_VFS_ROOT);
  if (inode === root) return root;
  const count = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_COUNT);
  let index: U32 = 0;
  while (index < count) {
    const dentry = dentryAt(memory, index);
    if (loadU32(memory, dentry + D_INODE) === inode) return loadU32(memory, dentry + D_PARENT);
    index += 1;
  }
  return 0;
};

const inSupplementaryGroup = (memory: TetoMemory, proc: Ptr, gid: U32): boolean => {
  const count = loadU32(memory, proc + P_GROUP_COUNT);
  let index: U32 = 0;
  while (index < count) {
    if (loadU32(memory, proc + P_GROUPS + index * 4) === gid) return true;
    index += 1;
  }
  return false;
};

const allowed = (memory: TetoMemory, proc: Ptr, inode: U32, bits: U32): boolean => {
  const state = inodeAt(memory, inode);
  const uid = loadU32(memory, proc + P_FSUID);
  if (uid === 0) return true;
  const owner = loadU32(memory, state + V_UID);
  const group = loadU32(memory, state + V_GID);
  const gid = loadU32(memory, proc + P_FSGID);
  const shift: U32 = uid === owner ? 6 : gid === group || inSupplementaryGroup(memory, proc, group) ? 3 : 0;
  return ((loadU32(memory, state + V_MODE) >>> shift) & bits) === bits;
};

const moreComponents = (memory: TetoMemory, at: Ptr, end: Ptr): boolean => {
  let cursor = at;
  while (cursor < end) {
    if (loadU8(memory, cursor) !== 47) return true;
    cursor += 1;
  }
  return false;
};

const resolveRange = (
  memory: TetoMemory,
  proc: Ptr,
  start: U32,
  path: Ptr,
  pathLength: U32,
  followFinal: boolean,
  hops: U32,
): I32 => {
  if (hops > 32) return -40;
  const root = loadU32(memory, TETO_CONTROL_BASE + C_VFS_ROOT);
  const end = path + pathLength;
  let cursor = path;
  let current = pathLength !== 0 && loadU8(memory, path) === 47 ? root : start;
  if (current === 0 || tetoVfsKind(memory, current) !== TETO_VFS_KIND_DIRECTORY) return -20;
  if (pathLength === 0) return -2;
  while (cursor < end) {
    while (cursor < end && loadU8(memory, cursor) === 47) cursor += 1;
    if (cursor === end) break;
    const component = cursor;
    while (cursor < end && loadU8(memory, cursor) !== 47) cursor += 1;
    const length = cursor - component;
    if (length > 255) return -36;
    const final = !moreComponents(memory, cursor, end);
    if (length === 1 && loadU8(memory, component) === 46) continue;
    if (length === 2 && loadU8(memory, component) === 46 && loadU8(memory, component + 1) === 46) {
      const parent = parentOf(memory, current);
      if (parent === 0) return -2;
      current = parent;
      continue;
    }
    if (tetoVfsKind(memory, current) !== TETO_VFS_KIND_DIRECTORY) return -20;
    if (!allowed(memory, proc, current, 1)) return -13;
    const child = findChild(memory, current, component, length);
    if (child === 0) return -2;
    if (tetoVfsKind(memory, child) === TETO_VFS_KIND_LINK && (!final || followFinal || cursor < end)) {
      const link = inodeAt(memory, child);
      const target = loadU32(memory, link + V_DATA);
      const targetLength = wordToU32(loadU64(memory, link + V_SIZE));
      if (targetLength === 0 || targetLength > 4096) return -2;
      const base = loadU8(memory, target) === 47 ? root : current;
      const resolved = resolveRange(memory, proc, base, target, targetLength, true, hops + 1);
      if (resolved < 0) return resolved;
      current = wordToU32(word(resolved));
    } else current = child;
  }
  if (pathLength !== 0 && loadU8(memory, end - 1) === 47 && tetoVfsKind(memory, current) !== TETO_VFS_KIND_DIRECTORY) return -20;
  return wordToI32(word(current));
};

export const tetoVfsLoaded = (memory: TetoMemory): boolean =>
  loadU32(memory, TETO_CONTROL_BASE + C_VFS_LOADED) === 1;

export const tetoVfsRoot = (memory: TetoMemory): U32 =>
  tetoVfsLoaded(memory) ? loadU32(memory, TETO_CONTROL_BASE + C_VFS_ROOT) : 0;

export const tetoVfsInodeCount = (memory: TetoMemory): U32 =>
  tetoVfsLoaded(memory) ? loadU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_COUNT) : 0;

export const tetoVfsDentryCount = (memory: TetoMemory): U32 =>
  tetoVfsLoaded(memory) ? loadU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_COUNT) : 0;

export const tetoVfsKind = (memory: TetoMemory, inode: U32): U32 => {
  if (!tetoVfsLoaded(memory) || inode === 0 || inode >= loadU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_CAPACITY)) return 0;
  return loadU32(memory, inodeAt(memory, inode) + V_KIND);
};

export const tetoVfsFileSize = (memory: TetoMemory, inode: U32): U64 =>
  tetoVfsKind(memory, inode) === TETO_VFS_KIND_EMPTY ? 0n : loadU64(memory, inodeAt(memory, inode) + V_SIZE);

export const tetoVfsMode = (memory: TetoMemory, inode: U32): U32 =>
  tetoVfsKind(memory, inode) === TETO_VFS_KIND_EMPTY ? 0 : loadU32(memory, inodeAt(memory, inode) + V_MODE);

export const tetoVfsUid = (memory: TetoMemory, inode: U32): U32 =>
  tetoVfsKind(memory, inode) === TETO_VFS_KIND_EMPTY ? 0 : loadU32(memory, inodeAt(memory, inode) + V_UID);

export const tetoVfsGid = (memory: TetoMemory, inode: U32): U32 =>
  tetoVfsKind(memory, inode) === TETO_VFS_KIND_EMPTY ? 0 : loadU32(memory, inodeAt(memory, inode) + V_GID);

export const tetoVfsNlink = (memory: TetoMemory, inode: U32): U32 =>
  tetoVfsKind(memory, inode) === TETO_VFS_KIND_EMPTY ? 0 : loadU32(memory, inodeAt(memory, inode) + V_NLINK);

export const tetoVfsLookup = (memory: TetoMemory, parent: U32, name: Ptr, nameLength: U32): U32 => {
  if (!tetoVfsLoaded(memory) || !inputContains(memory, name, nameLength) || !validName(memory, name, nameLength) ||
      tetoVfsKind(memory, parent) !== TETO_VFS_KIND_DIRECTORY) return 0;
  return findChild(memory, parent, name, nameLength);
};

export const tetoVfsResolve = (
  memory: TetoMemory,
  proc: Ptr,
  start: U32,
  path: Ptr,
  pathLength: U32,
  followFinal: boolean,
): I32 => {
  if (!tetoVfsLoaded(memory) || pathLength > 4096 || !memoryContains(memory, path, pathLength)) return -22;
  return resolveRange(memory, proc, start, path, pathLength, followFinal, 0);
};

export const tetoVfsAccess = (memory: TetoMemory, proc: Ptr, inode: U32, bits: U32): boolean =>
  tetoVfsKind(memory, inode) !== TETO_VFS_KIND_EMPTY && bits <= 7 && allowed(memory, proc, inode, bits);

export const tetoVfsReadData = (memory: TetoMemory, inode: U32, offset: U64, output: Ptr, length: U32): I32 => {
  const kind = tetoVfsKind(memory, inode);
  if ((kind !== TETO_VFS_KIND_FILE && kind !== TETO_VFS_KIND_LINK) || !inputContains(memory, output, length)) return -22;
  const state = inodeAt(memory, inode);
  const size = loadU64(memory, state + V_SIZE);
  if (offset > size) return -22;
  const available = size - offset;
  const amount = available < ux(word(length)) ? wordToU32(available) : length;
  if (amount !== 0) copyMemory(memory, output, loadU32(memory, state + V_DATA) + wordToU32(offset), amount);
  return wordToU32(word(amount));
};

export const tetoLoadVfs = (memory: TetoMemory, image: Ptr, imageLength: U32): I32 => {
  if (!inputContains(memory, image, imageLength) || imageLength < VFS_HEADER_SIZE ||
      loadU32(memory, image) !== TETO_VFS_IMAGE_MAGIC || loadU32(memory, image + 4) !== TETO_VFS_IMAGE_VERSION ||
      loadU32(memory, image + 20) !== imageLength) return TETO_VFS_RANGE;
  const inodeCount = loadU32(memory, image + 8);
  const dentryCount = loadU32(memory, image + 12);
  const root = loadU32(memory, image + 16);
  if (inodeCount === 0 || inodeCount >= TETO_VFS_INODE_CAPACITY || dentryCount > TETO_VFS_DENTRY_CAPACITY ||
      root === 0 || root >= TETO_VFS_INODE_CAPACITY) return TETO_VFS_CAPACITY_ERROR;
  if (hashBytes(memory, image + VFS_HEADER_SIZE, imageLength - VFS_HEADER_SIZE) !== loadU32(memory, image + 24)) {
    return TETO_VFS_CHECKSUM;
  }

  const inodeBase = loadU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_BASE);
  const dentryBase = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_BASE);
  const dataBase = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_BASE);
  const oldNext = loadU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_NEXT);
  fill(memory, inodeBase, TETO_VFS_INODE_CAPACITY * TETO_VFS_INODE_STRIDE, 0);
  fill(memory, dentryBase, TETO_VFS_DENTRY_CAPACITY * TETO_VFS_DENTRY_STRIDE, 0);
  if (oldNext > dataBase) fill(memory, dataBase, oldNext - dataBase, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_NEXT, dataBase);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_LOADED, 0);

  let cursor = image + VFS_HEADER_SIZE;
  const end = image + imageLength;
  let parsed: U32 = 0;
  while (parsed < inodeCount) {
    if (cursor > end || VFS_INODE_IMAGE_SIZE > end - cursor) return TETO_VFS_FORMAT;
    const inode = loadU32(memory, cursor);
    const kind = loadU32(memory, cursor + 4);
    const payloadLength = loadU32(memory, cursor + 24);
    if (inode === 0 || inode >= TETO_VFS_INODE_CAPACITY ||
        (kind !== TETO_VFS_KIND_FILE && kind !== TETO_VFS_KIND_DIRECTORY && kind !== TETO_VFS_KIND_LINK) ||
        loadU32(memory, cursor + 20) === 0 || payloadLength > TETO_VFS_DATA_CAPACITY ||
        (kind === TETO_VFS_KIND_DIRECTORY && payloadLength !== 0) ||
        cursor + VFS_INODE_IMAGE_SIZE > end || payloadLength > end - (cursor + VFS_INODE_IMAGE_SIZE)) return TETO_VFS_FORMAT;
    const state = inodeAt(memory, inode);
    if (loadU32(memory, state + V_KIND) !== TETO_VFS_KIND_EMPTY) return TETO_VFS_DUPLICATE;
    const data = allocateData(memory, payloadLength);
    if (data === 0xffffffff) return TETO_VFS_CAPACITY_ERROR;
    if (payloadLength !== 0) copyMemory(memory, data, cursor + VFS_INODE_IMAGE_SIZE, payloadLength);
    storeU32(memory, state + V_KIND, kind);
    storeU32(memory, state + V_MODE, loadU32(memory, cursor + 8) & 0xfff);
    storeU32(memory, state + V_UID, loadU32(memory, cursor + 12));
    storeU32(memory, state + V_GID, loadU32(memory, cursor + 16));
    storeU32(memory, state + V_NLINK, loadU32(memory, cursor + 20));
    storeU32(memory, state + V_FLAGS, 0);
    storeU64(memory, state + V_SIZE, ux(word(payloadLength)));
    storeU32(memory, state + V_DATA, data);
    storeU32(memory, state + V_CAPACITY, payloadLength);
    storeU64(memory, state + V_ATIME, loadU64(memory, cursor + 32));
    storeU64(memory, state + V_MTIME, loadU64(memory, cursor + 40));
    storeU64(memory, state + V_CTIME, loadU64(memory, cursor + 48));
    const record = VFS_INODE_IMAGE_SIZE + payloadLength;
    const aligned = align4(record);
    if (aligned < record || aligned > end - cursor) return TETO_VFS_FORMAT;
    cursor += aligned;
    parsed += 1;
  }
  if (loadU32(memory, inodeAt(memory, root) + V_KIND) !== TETO_VFS_KIND_DIRECTORY) return TETO_VFS_FORMAT;

  parsed = 0;
  while (parsed < dentryCount) {
    if (cursor > end || VFS_DENTRY_IMAGE_SIZE > end - cursor) return TETO_VFS_FORMAT;
    const parent = loadU32(memory, cursor);
    const inode = loadU32(memory, cursor + 4);
    const nameLength = loadU32(memory, cursor + 8);
    const nameAt = cursor + VFS_DENTRY_IMAGE_SIZE;
    if (parent === 0 || inode === 0 || parent >= TETO_VFS_INODE_CAPACITY || inode >= TETO_VFS_INODE_CAPACITY ||
        loadU32(memory, inodeAt(memory, parent) + V_KIND) !== TETO_VFS_KIND_DIRECTORY ||
        loadU32(memory, inodeAt(memory, inode) + V_KIND) === TETO_VFS_KIND_EMPTY ||
        nameLength > end - nameAt || !validName(memory, nameAt, nameLength)) return TETO_VFS_FORMAT;
    const hash = hashBytes(memory, nameAt, nameLength);
    let scan: U32 = 0;
    while (scan < parsed) {
      const existing = dentryAt(memory, scan);
      if (loadU32(memory, existing + D_PARENT) === parent && sameName(memory, existing, nameAt, nameLength, hash)) {
        return TETO_VFS_DUPLICATE;
      }
      scan += 1;
    }
    const name = allocateData(memory, nameLength);
    if (name === 0xffffffff) return TETO_VFS_CAPACITY_ERROR;
    copyMemory(memory, name, nameAt, nameLength);
    const dentry = dentryAt(memory, parsed);
    storeU32(memory, dentry + D_PARENT, parent);
    storeU32(memory, dentry + D_INODE, inode);
    storeU32(memory, dentry + D_NAME, name);
    storeU32(memory, dentry + D_NAME_LENGTH, nameLength);
    storeU32(memory, dentry + D_NAME_HASH, hash);
    storeU32(memory, dentry + D_FLAGS, 0);
    const record = VFS_DENTRY_IMAGE_SIZE + nameLength;
    const aligned = align4(record);
    if (aligned < record || aligned > end - cursor) return TETO_VFS_FORMAT;
    cursor += aligned;
    parsed += 1;
  }
  if (cursor !== end) return TETO_VFS_FORMAT;
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_COUNT, inodeCount);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_COUNT, dentryCount);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_ROOT, root);
  const processBase = loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_TABLE_BASE);
  const processCapacity = loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_CAPACITY);
  let processIndex: U32 = 0;
  while (processIndex < processCapacity) {
    const proc = processBase + processIndex * TETO_PROCESS_STRIDE;
    if (loadU32(memory, proc + P_STATE) !== wordToU32(word(TETO_PROCESS_EMPTY)) &&
        loadU32(memory, proc + P_CWD_INODE) === 0) storeU32(memory, proc + P_CWD_INODE, root);
    processIndex += 1;
  }
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DIRTY, 0);
  atomicStoreU64(memory, TETO_CONTROL_BASE + C_VFS_GENERATION,
    atomicLoadU64(memory, TETO_CONTROL_BASE + C_VFS_GENERATION) + 1n);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_LOADED, 1);
  return TETO_VFS_OK;
};
