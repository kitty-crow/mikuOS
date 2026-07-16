import {
  C_ABI,
  C_ACTIVE_WORKERS,
  C_ATOMIC_LOCK,
  C_CREDENTIAL_LOCK,
  C_DESCRIPTOR_CAPACITY,
  C_DESCRIPTOR_TABLE_BASE,
  C_FLAGS,
  C_MAGIC,
  C_MAX_HARTS,
  C_IMAGE_LOCK,
  C_IMAGE_SIZE,
  C_IMAGE_TOP,
  C_MEMORY_LOCK,
  C_MAP_CAPACITY,
  C_MAP_TABLE_BASE,
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
  C_VFS_LOCK,
  C_VFS_SCRATCH_BASE,
  C_PAGE_CAPACITY,
  C_PAGE_TABLE_BASE,
  C_PHYSICAL_END,
  C_PHYSICAL_NEXT,
  C_PROCESS_CAPACITY,
  C_PROCESS_COUNT,
  C_PROCESS_LOCK,
  C_PROCESS_TABLE_BASE,
  C_NEXT_PID,
  C_SCHED_CLAIMS,
  C_SCHED_CONTENTION,
  C_SCHED_CURSOR,
  C_SCHED_IDLE,
  C_SCHED_LOCK,
  C_SCHED_RUNS,
  C_SEGMENT_CAPACITY,
  C_SEGMENT_TABLE_BASE,
  C_WORKER_BASE,
  C_WORKER_CAPACITY,
  H_EVENT,
  H_EGID,
  H_EUID,
  H_EXIT_CODE,
  H_FALLBACK_SYSCALLS,
  H_FAULT,
  H_F,
  H_FCSR,
  H_HOST_TO_WASM,
  H_HOST_ADDRESS,
  H_HOST_DESCRIPTOR,
  H_HOST_LENGTH,
  H_HOST_OPERATION,
  H_HOST_REQUESTS,
  H_INTERNAL_SYSCALLS,
  H_INSTRUCTIONS,
  H_IMAGE_BYTES,
  H_IMAGE_FLOOR,
  H_IMAGE_LOADS,
  H_STACK_BOTTOM,
  H_STACK_POINTER,
  H_STARTUP_LOADS,
  H_KERNEL_SYSCALLS,
  H_LAST_INSTRUCTION,
  H_LAST_WORKER,
  H_LOCK,
  H_LOCK_CONTENTION,
  H_MIGRATIONS,
  H_PAGE_CAPACITY,
  H_PAGE_COUNT,
  H_PAGE_TABLE,
  H_PC,
  H_PROCESS_SLOT,
  H_PID,
  H_PPID,
  H_RGID,
  H_RUID,
  H_SGID,
  H_SUID,
  H_FSGID,
  H_FSUID,
  H_RESERVATION,
  H_STATUS,
  H_SYNC_WAITS,
  H_VIRTUAL_TOP,
  H_WASM_TO_HOST,
  H_X,
  TETO_ABI_VERSION,
  TETO_BATCH_BUDGET,
  TETO_BATCH_BUSY,
  TETO_BATCH_CONTENDED,
  TETO_BATCH_EXITED,
  TETO_BATCH_FAULT,
  TETO_BATCH_HOST,
  TETO_BATCH_SYSCALL,
  TETO_CONTROL_BASE,
  TETO_CONTROL_SIZE,
  TETO_EVENT_NONE,
  TETO_EVENT_HOST,
  TETO_EVENT_SYSCALL,
  TETO_FAULT_BAD_STATE,
  TETO_FAULT_BREAKPOINT,
  TETO_FAULT_INSTRUCTION,
  TETO_FAULT_MEMORY,
  TETO_FLAG_THREADED,
  TETO_GUEST_PAGE_SIZE,
  TETO_GROUP_CAPACITY,
  TETO_HART_BASE,
  TETO_HART_EMPTY,
  TETO_HART_EXITED,
  TETO_HART_FAULTED,
  TETO_HART_RUNNABLE,
  TETO_HART_STRIDE,
  TETO_HART_WAITING,
  TETO_HOST_NONE,
  TETO_HOST_WRITE,
  TETO_MAGIC,
  TETO_PAGE_CAPACITY,
  TETO_PAGE_ENTRY_SIZE,
  TETO_PROCESS_EMPTY,
  TETO_PROCESS_RUNNABLE,
  TETO_PROCESS_STRIDE,
  TETO_PROCESS_WAITING,
  TETO_PROCESS_ZOMBIE,
  TETO_WORKER_STRIDE,
  W_BATCHES,
  W_IDLE,
  W_INSTRUCTIONS,
  P_EGID,
  P_EUID,
  P_EXIT_CODE,
  P_FSGID,
  P_FSUID,
  P_GROUP_COUNT,
  P_GROUPS,
  P_PGID,
  P_PAGE_CAPACITY,
  P_PAGE_COUNT,
  P_PAGE_TABLE,
  P_PID,
  P_PPID,
  P_RGID,
  P_RUID,
  P_SGID,
  P_STATE,
  P_SUID,
  P_IMAGE_ENTRY,
  P_IMAGE_FLOOR,
  P_BRK,
  P_BRK_BASE,
  P_CWD_INODE,
  P_DESCRIPTOR_TABLE,
  P_DESCRIPTOR_CAPACITY,
  P_LOCK,
  P_MAP_CAPACITY,
  P_MAP_COUNT,
  P_MAP_NEXT,
  P_MAP_TABLE,
  P_UMASK,
  P_PHDR,
  P_PHENT,
  P_PHNUM,
  P_SEGMENT_COUNT,
  P_SEGMENT_TABLE,
  P_STACK_BOTTOM,
  P_STACK_POINTER,
  P_VIRTUAL_TOP,
  S_ADDRESS,
  S_END,
  S_FLAGS,
  S_NAME_HASH,
  S_NAME_LENGTH,
  TETO_SEGMENT_CAPACITY,
  TETO_SEGMENT_EXECUTE,
  TETO_SEGMENT_READ,
  TETO_SEGMENT_STRIDE,
  TETO_SEGMENT_WRITE,
  M_ADDRESS,
  M_BACKING,
  M_END,
  M_FILE_DESCRIPTOR,
  M_FILE_OFFSET,
  M_FLAGS,
  M_PROTECTION,
  TETO_MAP_BACKING_ANONYMOUS,
  TETO_MAP_CAPACITY,
  TETO_MAP_STRIDE,
  FD_CURSOR,
  FD_FLAGS,
  FD_INODE,
  FD_KIND,
  FD_OFFSET,
  TETO_DESCRIPTOR_CAPACITY,
  TETO_DESCRIPTOR_STRIDE,
  TETO_FD_CLOEXEC,
  TETO_FD_DIRECTORY,
  TETO_FD_EMPTY,
  TETO_FD_FILE,
  TETO_FD_HOST,
  TETO_FD_READ,
  TETO_FD_WRITE,
  TETO_VFS_DATA_CAPACITY,
  TETO_VFS_DENTRY_CAPACITY,
  TETO_VFS_DENTRY_STRIDE,
  TETO_VFS_INODE_CAPACITY,
  TETO_VFS_INODE_STRIDE,
  TETO_VFS_KIND_DIRECTORY,
  TETO_VFS_KIND_FILE,
  TETO_VFS_PATH_CAPACITY,
  TETO_START_FORMAT,
  TETO_START_MEMORY,
  TETO_START_OK,
  TETO_START_RANGE,
  TETO_THX_BUSY,
  TETO_THX_MEMORY,
  TETO_THX_OK,
  TETO_THX_RANGE,
  TETO_THX_SECTION,
} from "./abi.js";
import {
  atomicAddI32,
  atomicAddU64,
  atomicLoadI32,
  atomicLoadU64,
  atomicStoreU64,
  atomicStoreI32,
  compareExchangeI32,
  copyMemory,
  fill,
  loadI16,
  loadI32,
  loadI64,
  loadI8,
  loadU16,
  loadU32,
  loadU64,
  loadU8,
  memorySize as memorySizeOf,
  storeI32,
  storeI64,
  storeU16,
  storeU32,
  storeU64,
  storeU8,
} from "./memory.js";
import type { TetoMemory } from "./memory.js";
import type { F64, I32, I64, Ptr, U32, U64 } from "./types.js";
import {
  bitsToF32,
  bitsToF64,
  divSigned,
  divUnsigned,
  f32ToBits,
  f64ToBits,
  floatCeil,
  floatFloor,
  floatIsNaN,
  floatMax,
  floatMin,
  floatSqrt,
  floatToI64,
  floatToU64,
  floatTrunc,
  mulHighSigned,
  mulHighSignedUnsigned,
  mulHighUnsigned,
  remSigned,
  remUnsigned,
  roundF32,
  sx,
  u32word,
  ux,
  word,
  wordToI32,
  wordToPtr,
  wordToU32,
  wordToFloat,
  unsignedWordToFloat,
} from "./word.js";
import {
  tetoVfsAccess,
  tetoVfsFileSize,
  tetoVfsKind,
  tetoVfsReadData,
  tetoVfsResolve,
  tetoVfsRoot,
} from "./vfs.js";

const NO_RESERVATION: I64 = -1n;
const INVALID_POINTER: Ptr = 0xffffffff;
const UNMAPPED_POINTER: Ptr = 0xfffffffe;
const INVALID_PROCESS: U32 = 0xffffffff;
const MAP_NOT_OWNED: I64 = -4096n;
const MAP_PAGE: U64 = 4096n;
const MAP_GUARD: U64 = 1024n * 1024n;
const MAP_SPACING: U64 = 16n * 1024n * 1024n;
const OPEN_DIRECTORY: U32 = 0x10000;
const OPEN_CLOEXEC: U32 = 0x80000;

const hartAt = (hart: U32): Ptr => TETO_HART_BASE + hart * TETO_HART_STRIDE;
const regAt = (hart: U32, register: U32): Ptr => hartAt(hart) + H_X + register * 8;
const floatRegAt = (hart: U32, register: U32): Ptr => hartAt(hart) + H_F + register * 8;
const pageAlign = (value: U32): U32 => (value + TETO_GUEST_PAGE_SIZE - 1) & -TETO_GUEST_PAGE_SIZE;
const processAt = (memory: TetoMemory, slot: U32): Ptr =>
  loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_TABLE_BASE) + slot * TETO_PROCESS_STRIDE;
const processForHart = (memory: TetoMemory, hart: U32): Ptr => {
  const slot = loadU32(memory, hartAt(hart) + H_PROCESS_SLOT);
  return slot < loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_CAPACITY) ? processAt(memory, slot) : INVALID_POINTER;
};
const descriptorAt = (memory: TetoMemory, proc: Ptr, descriptor: U32): Ptr =>
  loadU32(memory, proc + P_DESCRIPTOR_TABLE) + descriptor * TETO_DESCRIPTOR_STRIDE;
const workerAt = (worker: U32): Ptr => C_WORKER_BASE + worker * TETO_WORKER_STRIDE;

const validHart = (memory: TetoMemory, hart: U32): boolean =>
  hart < loadU32(memory, TETO_CONTROL_BASE + C_MAX_HARTS);

const bump = (memory: TetoMemory, at: Ptr): void => {
  atomicAddU64(memory, at, 1n);
};

const acquire = (memory: TetoMemory, at: Ptr): boolean =>
  compareExchangeI32(memory, at, 0, 1) === 0;

const release = (memory: TetoMemory, at: Ptr): void => atomicStoreI32(memory, at, 0);

export const tetoKernelInit = (memory: TetoMemory, maxHarts: U32, threaded: boolean): I32 => {
  if (maxHarts < 1 || maxHarts > 1024) return TETO_FAULT_BAD_STATE;
  const hartEnd = TETO_HART_BASE + maxHarts * TETO_HART_STRIDE;
  const processCapacity = maxHarts > 32 ? 256 : maxHarts * 8;
  const pageTables = pageAlign(hartEnd);
  const tableBytes = processCapacity * TETO_PAGE_CAPACITY * TETO_PAGE_ENTRY_SIZE;
  const segmentTables = pageAlign(pageTables + tableBytes);
  const segmentBytes = processCapacity * TETO_SEGMENT_CAPACITY * TETO_SEGMENT_STRIDE;
  const mapTables = pageAlign(segmentTables + segmentBytes);
  const mapBytes = processCapacity * TETO_MAP_CAPACITY * TETO_MAP_STRIDE;
  const vfsScratch = pageAlign(mapTables + mapBytes);
  const inodeTable = pageAlign(vfsScratch + TETO_VFS_PATH_CAPACITY);
  const dentryTable = pageAlign(inodeTable + TETO_VFS_INODE_CAPACITY * TETO_VFS_INODE_STRIDE);
  const descriptorTables = pageAlign(dentryTable + TETO_VFS_DENTRY_CAPACITY * TETO_VFS_DENTRY_STRIDE);
  const descriptorBytes = processCapacity * TETO_DESCRIPTOR_CAPACITY * TETO_DESCRIPTOR_STRIDE;
  const processTable = pageAlign(descriptorTables + descriptorBytes);
  const vfsData = pageAlign(processTable + processCapacity * TETO_PROCESS_STRIDE);
  const physical = pageAlign(vfsData + TETO_VFS_DATA_CAPACITY);
  const total = memorySizeOf(memory);
  if (physical < pageTables || physical > total || total - physical < TETO_GUEST_PAGE_SIZE) return TETO_FAULT_MEMORY;
  fill(memory, TETO_CONTROL_BASE, physical, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_MAGIC, TETO_MAGIC);
  storeU32(memory, TETO_CONTROL_BASE + C_ABI, TETO_ABI_VERSION);
  storeU32(memory, TETO_CONTROL_BASE + C_FLAGS, threaded ? TETO_FLAG_THREADED : 0);
  storeU32(memory, TETO_CONTROL_BASE + C_MAX_HARTS, maxHarts);
  storeU32(memory, TETO_CONTROL_BASE + C_PAGE_TABLE_BASE, pageTables);
  storeU32(memory, TETO_CONTROL_BASE + C_PAGE_CAPACITY, TETO_PAGE_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_SEGMENT_TABLE_BASE, segmentTables);
  storeU32(memory, TETO_CONTROL_BASE + C_SEGMENT_CAPACITY, TETO_SEGMENT_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_MAP_TABLE_BASE, mapTables);
  storeU32(memory, TETO_CONTROL_BASE + C_MAP_CAPACITY, TETO_MAP_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_SCRATCH_BASE, vfsScratch);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_BASE, inodeTable);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_CAPACITY, TETO_VFS_INODE_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_BASE, dentryTable);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_CAPACITY, TETO_VFS_DENTRY_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_BASE, vfsData);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_END, vfsData + TETO_VFS_DATA_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DATA_NEXT, vfsData);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_INODE_COUNT, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DENTRY_COUNT, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_ROOT, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_LOADED, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_VFS_DIRTY, 0);
  storeU64(memory, TETO_CONTROL_BASE + C_VFS_GENERATION, 0n);
  storeU32(memory, TETO_CONTROL_BASE + C_DESCRIPTOR_TABLE_BASE, descriptorTables);
  storeU32(memory, TETO_CONTROL_BASE + C_DESCRIPTOR_CAPACITY, TETO_DESCRIPTOR_CAPACITY);
  storeU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_NEXT, physical);
  storeU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_END, total);
  storeU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP, total);
  storeU32(memory, TETO_CONTROL_BASE + C_IMAGE_SIZE, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_PROCESS_TABLE_BASE, processTable);
  storeU32(memory, TETO_CONTROL_BASE + C_PROCESS_CAPACITY, processCapacity);
  storeU32(memory, TETO_CONTROL_BASE + C_PROCESS_COUNT, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_NEXT_PID, 2);
  storeU32(memory, TETO_CONTROL_BASE + C_SCHED_CURSOR, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_WORKER_CAPACITY, maxHarts > 128 ? 128 : maxHarts);
  return 0;
};

export const tetoKernelValid = (memory: TetoMemory): boolean =>
  loadU32(memory, TETO_CONTROL_BASE + C_MAGIC) === TETO_MAGIC &&
  loadU32(memory, TETO_CONTROL_BASE + C_ABI) === TETO_ABI_VERSION;

export const tetoHartInit = (
  memory: TetoMemory,
  hart: U32,
  virtualTop: U64,
  pc: U64,
): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart)) return TETO_FAULT_BAD_STATE;
  if (virtualTop < 1024n * 1024n || virtualTop > 0x0000ffffffffffffn || pc >= virtualTop) return TETO_FAULT_MEMORY;
  const at = hartAt(hart);
  const capacity = loadU32(memory, TETO_CONTROL_BASE + C_PAGE_CAPACITY);
  fill(memory, at, TETO_HART_STRIDE, 0);
  storeU64(memory, at + H_VIRTUAL_TOP, virtualTop);
  storeU32(memory, at + H_PAGE_TABLE, INVALID_POINTER);
  storeU32(memory, at + H_PAGE_CAPACITY, capacity);
  storeU32(memory, at + H_PAGE_COUNT, 0);
  storeU64(memory, at + H_PC, pc);
  storeI64(memory, at + H_RESERVATION, NO_RESERVATION);
  storeI32(memory, at + H_LAST_WORKER, -1);
  storeU32(memory, at + H_PROCESS_SLOT, INVALID_PROCESS);
  atomicStoreI32(memory, at + H_STATUS, TETO_HART_RUNNABLE);
  return 0;
};

export const tetoProcessInit = (
  memory: TetoMemory,
  hart: U32,
  pid: U32,
  ppid: U32,
  ruid: U32,
  euid: U32,
  suid: U32,
  rgid: U32,
  egid: U32,
  sgid: U32,
): I32 => {
  if (!validHart(memory, hart) || pid < 1) return TETO_FAULT_BAD_STATE;
  const lock = TETO_CONTROL_BASE + C_PROCESS_LOCK;
  if (!acquire(memory, lock)) return TETO_BATCH_CONTENDED;
  const capacity = loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_CAPACITY);
  let slot = INVALID_PROCESS;
  let index: U32 = 0;
  while (index < capacity) {
    const proc = processAt(memory, index);
    const state = atomicLoadI32(memory, proc + P_STATE);
    if (state !== TETO_PROCESS_EMPTY && loadU32(memory, proc + P_PID) === pid) {
      release(memory, lock);
      return TETO_FAULT_BAD_STATE;
    }
    if (state === TETO_PROCESS_EMPTY && slot === INVALID_PROCESS) slot = index;
    index += 1;
  }
  if (slot === INVALID_PROCESS) {
    release(memory, lock);
    return TETO_FAULT_MEMORY;
  }
  const proc = processAt(memory, slot);
  const pageCapacity = loadU32(memory, TETO_CONTROL_BASE + C_PAGE_CAPACITY);
  const pageTable = loadU32(memory, TETO_CONTROL_BASE + C_PAGE_TABLE_BASE) + slot * pageCapacity * TETO_PAGE_ENTRY_SIZE;
  const segmentCapacity = loadU32(memory, TETO_CONTROL_BASE + C_SEGMENT_CAPACITY);
  const segmentTable = loadU32(memory, TETO_CONTROL_BASE + C_SEGMENT_TABLE_BASE) + slot * segmentCapacity * TETO_SEGMENT_STRIDE;
  const mapCapacity = loadU32(memory, TETO_CONTROL_BASE + C_MAP_CAPACITY);
  const mapTable = loadU32(memory, TETO_CONTROL_BASE + C_MAP_TABLE_BASE) + slot * mapCapacity * TETO_MAP_STRIDE;
  const descriptorCapacity = loadU32(memory, TETO_CONTROL_BASE + C_DESCRIPTOR_CAPACITY);
  const descriptorTable = loadU32(memory, TETO_CONTROL_BASE + C_DESCRIPTOR_TABLE_BASE) +
    slot * descriptorCapacity * TETO_DESCRIPTOR_STRIDE;
  const virtualTop = loadU64(memory, hartAt(hart) + H_VIRTUAL_TOP);
  fill(memory, proc, TETO_PROCESS_STRIDE, 0);
  fill(memory, pageTable, pageCapacity * TETO_PAGE_ENTRY_SIZE, 0);
  fill(memory, segmentTable, segmentCapacity * TETO_SEGMENT_STRIDE, 0);
  fill(memory, mapTable, mapCapacity * TETO_MAP_STRIDE, 0);
  fill(memory, descriptorTable, descriptorCapacity * TETO_DESCRIPTOR_STRIDE, 0);
  atomicStoreI32(memory, proc + P_PID, wordToI32(word(pid)));
  atomicStoreI32(memory, proc + P_PPID, wordToI32(word(ppid)));
  atomicStoreI32(memory, proc + P_PGID, wordToI32(word(pid)));
  atomicStoreI32(memory, proc + P_RUID, wordToI32(word(ruid)));
  atomicStoreI32(memory, proc + P_EUID, wordToI32(word(euid)));
  atomicStoreI32(memory, proc + P_SUID, wordToI32(word(suid)));
  atomicStoreI32(memory, proc + P_FSUID, wordToI32(word(euid)));
  atomicStoreI32(memory, proc + P_RGID, wordToI32(word(rgid)));
  atomicStoreI32(memory, proc + P_EGID, wordToI32(word(egid)));
  atomicStoreI32(memory, proc + P_SGID, wordToI32(word(sgid)));
  atomicStoreI32(memory, proc + P_FSGID, wordToI32(word(egid)));
  atomicStoreI32(memory, proc + P_PAGE_TABLE, wordToI32(word(pageTable)));
  atomicStoreI32(memory, proc + P_PAGE_CAPACITY, wordToI32(word(pageCapacity)));
  atomicStoreI32(memory, proc + P_PAGE_COUNT, 0);
  atomicStoreU64(memory, proc + P_VIRTUAL_TOP, virtualTop);
  atomicStoreI32(memory, proc + P_SEGMENT_TABLE, wordToI32(word(segmentTable)));
  atomicStoreI32(memory, proc + P_SEGMENT_COUNT, 0);
  atomicStoreI32(memory, proc + P_MAP_TABLE, wordToI32(word(mapTable)));
  atomicStoreI32(memory, proc + P_MAP_COUNT, 0);
  atomicStoreI32(memory, proc + P_MAP_CAPACITY, wordToI32(word(mapCapacity)));
  atomicStoreU64(memory, proc + P_MAP_NEXT, 0x4000000000n);
  atomicStoreI32(memory, proc + P_CWD_INODE, wordToI32(word(tetoVfsRoot(memory))));
  atomicStoreI32(memory, proc + P_UMASK, 0o022);
  atomicStoreI32(memory, proc + P_DESCRIPTOR_TABLE, wordToI32(word(descriptorTable)));
  atomicStoreI32(memory, proc + P_DESCRIPTOR_CAPACITY, wordToI32(word(descriptorCapacity)));
  storeU32(memory, descriptorAt(memory, proc, 0) + FD_KIND, TETO_FD_HOST);
  storeU32(memory, descriptorAt(memory, proc, 0) + FD_FLAGS, TETO_FD_READ);
  storeU32(memory, descriptorAt(memory, proc, 1) + FD_KIND, TETO_FD_HOST);
  storeU32(memory, descriptorAt(memory, proc, 1) + FD_FLAGS, TETO_FD_WRITE);
  storeU32(memory, descriptorAt(memory, proc, 2) + FD_KIND, TETO_FD_HOST);
  storeU32(memory, descriptorAt(memory, proc, 2) + FD_FLAGS, TETO_FD_WRITE);
  atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_RUNNABLE);
  storeU32(memory, hartAt(hart) + H_PROCESS_SLOT, slot);
  storeU32(memory, hartAt(hart) + H_PAGE_TABLE, pageTable);
  storeU32(memory, hartAt(hart) + H_PAGE_CAPACITY, pageCapacity);
  storeU32(memory, hartAt(hart) + H_PAGE_COUNT, 0);
  storeU32(memory, TETO_CONTROL_BASE + C_PROCESS_COUNT, loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_COUNT) + 1);
  if (pid >= loadU32(memory, TETO_CONTROL_BASE + C_NEXT_PID)) storeU32(memory, TETO_CONTROL_BASE + C_NEXT_PID, pid + 1);
  release(memory, lock);
  return 0;
};

export const tetoProcessSetGroup = (memory: TetoMemory, hart: U32, index: U32, gid: U32): I32 => {
  if (!validHart(memory, hart) || index >= TETO_GROUP_CAPACITY) return TETO_FAULT_BAD_STATE;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return TETO_FAULT_BAD_STATE;
  const lock = TETO_CONTROL_BASE + C_CREDENTIAL_LOCK;
  if (!acquire(memory, lock)) return TETO_BATCH_CONTENDED;
  const count = loadU32(memory, proc + P_GROUP_COUNT);
  if (index > count) {
    release(memory, lock);
    return TETO_FAULT_BAD_STATE;
  }
  atomicStoreI32(memory, proc + P_GROUPS + index * 4, wordToI32(word(gid)));
  if (index === count) atomicStoreI32(memory, proc + P_GROUP_COUNT, wordToI32(word(count + 1)));
  release(memory, lock);
  return 0;
};

export const tetoProcessCount = (memory: TetoMemory): U32 =>
  tetoKernelValid(memory) ? loadU32(memory, TETO_CONTROL_BASE + C_PROCESS_COUNT) : 0;

export const tetoResolvePath = (
  memory: TetoMemory,
  hart: U32,
  start: U32,
  path: Ptr,
  pathLength: U32,
  followFinal: boolean,
): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart)) return -22;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return -3;
  const lock = TETO_CONTROL_BASE + C_VFS_LOCK;
  if (!acquire(memory, lock)) return -11;
  const result = tetoVfsResolve(memory, proc, start, path, pathLength, followFinal);
  release(memory, lock);
  return result;
};

export const tetoAccessInode = (memory: TetoMemory, hart: U32, inode: U32, bits: U32): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart)) return -22;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return -3;
  const lock = TETO_CONTROL_BASE + C_VFS_LOCK;
  if (!acquire(memory, lock)) return -11;
  const result = tetoVfsAccess(memory, proc, inode, bits) ? 1 : 0;
  release(memory, lock);
  return result;
};

export const tetoOpenPath = (
  memory: TetoMemory,
  hart: U32,
  start: U32,
  path: Ptr,
  pathLength: U32,
  flags: U32,
): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart) || (flags & 3) !== 0) return -30;
  if ((flags & ~(OPEN_DIRECTORY | OPEN_CLOEXEC)) !== 0) return -22;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return -3;
  if (!acquire(memory, proc + P_LOCK)) return -11;
  const vfsLock = TETO_CONTROL_BASE + C_VFS_LOCK;
  if (!acquire(memory, vfsLock)) {
    release(memory, proc + P_LOCK);
    return -11;
  }
  const base = start === 0 ? loadU32(memory, proc + P_CWD_INODE) : start;
  const resolved = tetoVfsResolve(memory, proc, base, path, pathLength, true);
  if (resolved < 0) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return resolved;
  }
  const inode = wordToU32(word(resolved));
  const kind = tetoVfsKind(memory, inode);
  if ((flags & OPEN_DIRECTORY) !== 0 && kind !== TETO_VFS_KIND_DIRECTORY) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -20;
  }
  if (kind !== TETO_VFS_KIND_FILE && kind !== TETO_VFS_KIND_DIRECTORY) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -22;
  }
  if (!tetoVfsAccess(memory, proc, inode, kind === TETO_VFS_KIND_DIRECTORY ? 5 : 4)) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -13;
  }
  const capacity = loadU32(memory, proc + P_DESCRIPTOR_CAPACITY);
  let descriptor: U32 = 3;
  while (descriptor < capacity && loadU32(memory, descriptorAt(memory, proc, descriptor) + FD_KIND) !== TETO_FD_EMPTY) {
    descriptor += 1;
  }
  if (descriptor === capacity) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -24;
  }
  const state = descriptorAt(memory, proc, descriptor);
  fill(memory, state, TETO_DESCRIPTOR_STRIDE, 0);
  storeU32(memory, state + FD_KIND, kind === TETO_VFS_KIND_DIRECTORY ? TETO_FD_DIRECTORY : TETO_FD_FILE);
  storeU32(memory, state + FD_FLAGS, TETO_FD_READ | ((flags & OPEN_CLOEXEC) !== 0 ? TETO_FD_CLOEXEC : 0));
  storeU32(memory, state + FD_INODE, inode);
  storeU64(memory, state + FD_OFFSET, 0n);
  storeU32(memory, state + FD_CURSOR, 0);
  release(memory, vfsLock);
  release(memory, proc + P_LOCK);
  return wordToI32(word(descriptor));
};

export const tetoReadDescriptor = (
  memory: TetoMemory,
  hart: U32,
  descriptor: U32,
  output: Ptr,
  length: U32,
): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart) || length > 1048576) return -22;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER || descriptor >= loadU32(memory, proc + P_DESCRIPTOR_CAPACITY)) return -9;
  if (!acquire(memory, proc + P_LOCK)) return -11;
  const vfsLock = TETO_CONTROL_BASE + C_VFS_LOCK;
  if (!acquire(memory, vfsLock)) {
    release(memory, proc + P_LOCK);
    return -11;
  }
  const state = descriptorAt(memory, proc, descriptor);
  const kind = loadU32(memory, state + FD_KIND);
  if (kind === TETO_FD_DIRECTORY) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -21;
  }
  if (kind !== TETO_FD_FILE || (loadU32(memory, state + FD_FLAGS) & TETO_FD_READ) === 0) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -9;
  }
  if (length === 0) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return 0;
  }
  const amount = tetoVfsReadData(memory, loadU32(memory, state + FD_INODE), loadU64(memory, state + FD_OFFSET), output, length);
  if (amount > 0) storeU64(memory, state + FD_OFFSET, loadU64(memory, state + FD_OFFSET) + ux(word(amount)));
  release(memory, vfsLock);
  release(memory, proc + P_LOCK);
  return amount;
};

export const tetoSeekDescriptor = (
  memory: TetoMemory,
  hart: U32,
  descriptor: U32,
  offset: I64,
  whence: U32,
): I64 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart) || whence > 2) return -22n;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER || descriptor >= loadU32(memory, proc + P_DESCRIPTOR_CAPACITY)) return -9n;
  if (!acquire(memory, proc + P_LOCK)) return -11n;
  const vfsLock = TETO_CONTROL_BASE + C_VFS_LOCK;
  if (!acquire(memory, vfsLock)) {
    release(memory, proc + P_LOCK);
    return -11n;
  }
  const state = descriptorAt(memory, proc, descriptor);
  const kind = loadU32(memory, state + FD_KIND);
  if (kind !== TETO_FD_FILE && kind !== TETO_FD_DIRECTORY) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -9n;
  }
  let base: I64 = 0n;
  if (whence === 1) base = sx(loadU64(memory, state + FD_OFFSET), 64);
  else if (whence === 2) base = sx(tetoVfsFileSize(memory, loadU32(memory, state + FD_INODE)), 64);
  const next = base + offset;
  if (next < 0n || (offset > 0n && next < base)) {
    release(memory, vfsLock);
    release(memory, proc + P_LOCK);
    return -22n;
  }
  storeU64(memory, state + FD_OFFSET, ux(next));
  release(memory, vfsLock);
  release(memory, proc + P_LOCK);
  return next;
};

export const tetoCloseDescriptor = (memory: TetoMemory, hart: U32, descriptor: U32): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart)) return -22;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER || descriptor >= loadU32(memory, proc + P_DESCRIPTOR_CAPACITY)) return -9;
  if (!acquire(memory, proc + P_LOCK)) return -11;
  const state = descriptorAt(memory, proc, descriptor);
  if (loadU32(memory, state + FD_KIND) === TETO_FD_EMPTY) {
    release(memory, proc + P_LOCK);
    return -9;
  }
  fill(memory, state, TETO_DESCRIPTOR_STRIDE, 0);
  release(memory, proc + P_LOCK);
  return 0;
};

export const tetoDescriptorKind = (memory: TetoMemory, hart: U32, descriptor: U32): U32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER || descriptor >= loadU32(memory, proc + P_DESCRIPTOR_CAPACITY)) return 0;
  return loadU32(memory, descriptorAt(memory, proc, descriptor) + FD_KIND);
};

export const tetoDescriptorInode = (memory: TetoMemory, hart: U32, descriptor: U32): U32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER || descriptor >= loadU32(memory, proc + P_DESCRIPTOR_CAPACITY)) return 0;
  return loadU32(memory, descriptorAt(memory, proc, descriptor) + FD_INODE);
};

export const tetoDescriptorOffset = (memory: TetoMemory, hart: U32, descriptor: U32): U64 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER || descriptor >= loadU32(memory, proc + P_DESCRIPTOR_CAPACITY)) return 0n;
  return loadU64(memory, descriptorAt(memory, proc, descriptor) + FD_OFFSET);
};

export const tetoImageReserve = (memory: TetoMemory, size: U32): Ptr => {
  if (!tetoKernelValid(memory) || size === 0 || size > 0x7ffffff0) return INVALID_POINTER;
  const imageLock = TETO_CONTROL_BASE + C_IMAGE_LOCK;
  if (!acquire(memory, imageLock)) return INVALID_POINTER;
  const memoryLock = TETO_CONTROL_BASE + C_MEMORY_LOCK;
  if (!acquire(memory, memoryLock)) {
    release(memory, imageLock);
    return INVALID_POINTER;
  }
  const aligned = (size + 15) & -16;
  const end = loadU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_END);
  const next = loadU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_NEXT);
  if (aligned < size || aligned > end || end - aligned < next) {
    release(memory, memoryLock);
    release(memory, imageLock);
    return INVALID_POINTER;
  }
  const at = end - aligned;
  storeU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP, at);
  storeU32(memory, TETO_CONTROL_BASE + C_IMAGE_SIZE, aligned);
  release(memory, memoryLock);
  return at;
};

export const tetoImageContains = (memory: TetoMemory, at: Ptr, size: U32): boolean => {
  if (atomicLoadI32(memory, TETO_CONTROL_BASE + C_IMAGE_LOCK) !== 1) return false;
  const start = loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP);
  const length = loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_SIZE);
  return at >= start && at - start <= length && size <= length - (at - start);
};

export const tetoImageRelease = (memory: TetoMemory, at: Ptr, size: U32): I32 => {
  if (!tetoKernelValid(memory) || size === 0 || size > 0x7ffffff0) return TETO_THX_RANGE;
  const aligned = (size + 15) & -16;
  const imageLock = TETO_CONTROL_BASE + C_IMAGE_LOCK;
  if (atomicLoadI32(memory, imageLock) !== 1 ||
      at !== loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP) ||
      aligned !== loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_SIZE)) return TETO_THX_RANGE;
  const memoryLock = TETO_CONTROL_BASE + C_MEMORY_LOCK;
  if (!acquire(memory, memoryLock)) return TETO_THX_BUSY;
  storeU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP, loadU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_END));
  storeU32(memory, TETO_CONTROL_BASE + C_IMAGE_SIZE, 0);
  release(memory, memoryLock);
  release(memory, imageLock);
  return TETO_THX_OK;
};

export const tetoHartVirtualTop = (memory: TetoMemory, hart: U32): U64 =>
  validHart(memory, hart) ? loadU64(memory, hartAt(hart) + H_VIRTUAL_TOP) : 0n;

export const tetoHartImageFloor = (memory: TetoMemory, hart: U32): U64 =>
  validHart(memory, hart) ? loadU64(memory, hartAt(hart) + H_IMAGE_FLOOR) : 0n;

export const tetoHartStackBottom = (memory: TetoMemory, hart: U32): U64 =>
  validHart(memory, hart) ? loadU64(memory, hartAt(hart) + H_STACK_BOTTOM) : 0n;

export const tetoHartStackPointer = (memory: TetoMemory, hart: U32): U64 =>
  validHart(memory, hart) ? loadU64(memory, hartAt(hart) + H_STACK_POINTER) : 0n;

export const tetoHartBreak = (memory: TetoMemory, hart: U32): U64 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  return proc === INVALID_POINTER ? 0n : atomicLoadU64(memory, proc + P_BRK);
};

export const tetoProcessSegmentCount = (memory: TetoMemory, hart: U32): U32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  return proc === INVALID_POINTER ? 0 : loadU32(memory, proc + P_SEGMENT_COUNT);
};

export const tetoProcessMapCount = (memory: TetoMemory, hart: U32): U32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  return proc === INVALID_POINTER ? 0 : loadU32(memory, proc + P_MAP_COUNT);
};

export const tetoProcessMapAddress = (
  memory: TetoMemory,
  hart: U32,
  index: U32,
): U64 => {
  const proc = validHart(memory, hart)
    ? processForHart(memory, hart)
    : INVALID_POINTER;

  if (
    proc === INVALID_POINTER ||
    index >= loadU32(memory, proc + P_MAP_COUNT)
  ) return 0n;

  return loadU64(memory, mapAt(memory, proc, index) + M_ADDRESS);
};

export const tetoProcessMapEnd = (
  memory: TetoMemory,
  hart: U32,
  index: U32,
): U64 => {
  const proc = validHart(memory, hart)
    ? processForHart(memory, hart)
    : INVALID_POINTER;

  if (
    proc === INVALID_POINTER ||
    index >= loadU32(memory, proc + P_MAP_COUNT)
  ) return 0n;

  return loadU64(memory, mapAt(memory, proc, index) + M_END);
};

export const tetoProcessMapProtection = (
  memory: TetoMemory,
  hart: U32,
  index: U32,
): U32 => {
  const proc = validHart(memory, hart)
    ? processForHart(memory, hart)
    : INVALID_POINTER;

  if (
    proc === INVALID_POINTER ||
    index >= loadU32(memory, proc + P_MAP_COUNT)
  ) return 0;

  return loadU32(memory, mapAt(memory, proc, index) + M_PROTECTION);
};

export const tetoHartGetX = (memory: TetoMemory, hart: U32, register: U32): I64 => {
  if (!validHart(memory, hart) || register > 31) return 0n;
  return register === 0 ? 0n : loadI64(memory, regAt(hart, register));
};

export const tetoHartSetX = (memory: TetoMemory, hart: U32, register: U32, value: I64): I32 => {
  if (!validHart(memory, hart) || register > 31) return TETO_FAULT_BAD_STATE;
  if (register !== 0) storeI64(memory, regAt(hart, register), sx(value, 64));
  return 0;
};

export const tetoHartGetF = (memory: TetoMemory, hart: U32, register: U32): U64 => {
  if (!validHart(memory, hart) || register > 31) return 0n;
  return loadU64(memory, floatRegAt(hart, register));
};

export const tetoHartSetF = (memory: TetoMemory, hart: U32, register: U32, value: U64): I32 => {
  if (!validHart(memory, hart) || register > 31) return TETO_FAULT_BAD_STATE;
  storeU64(memory, floatRegAt(hart, register), value);
  return 0;
};

export const tetoHartPc = (memory: TetoMemory, hart: U32): U64 =>
  validHart(memory, hart) ? loadU64(memory, hartAt(hart) + H_PC) : 0n;

export const tetoHartSetPc = (memory: TetoMemory, hart: U32, pc: U64): I32 => {
  if (!validHart(memory, hart) || pc >= loadU64(memory, hartAt(hart) + H_VIRTUAL_TOP)) return TETO_FAULT_BAD_STATE;
  storeU64(memory, hartAt(hart) + H_PC, pc);
  return 0;
};

export const tetoHartStatus = (memory: TetoMemory, hart: U32): I32 =>
  validHart(memory, hart) ? atomicLoadI32(memory, hartAt(hart) + H_STATUS) : TETO_HART_EMPTY;

export const tetoHartMetric = (memory: TetoMemory, hart: U32, offset: U32): U64 => {
  if (!validHart(memory, hart) || offset + 8 > TETO_HART_STRIDE || (offset & 7) !== 0) return 0n;
  return loadU64(memory, hartAt(hart) + offset);
};

export const tetoHostOperation = (memory: TetoMemory, hart: U32): I32 =>
  validHart(memory, hart) ? loadI32(memory, hartAt(hart) + H_HOST_OPERATION) : TETO_HOST_NONE;

export const tetoHostDescriptor = (memory: TetoMemory, hart: U32): I32 =>
  validHart(memory, hart) ? loadI32(memory, hartAt(hart) + H_HOST_DESCRIPTOR) : -1;

export const tetoHostAddress = (memory: TetoMemory, hart: U32): U64 =>
  validHart(memory, hart) ? loadU64(memory, hartAt(hart) + H_HOST_ADDRESS) : 0n;

export const tetoHostLength = (memory: TetoMemory, hart: U32): U32 =>
  validHart(memory, hart) ? loadU32(memory, hartAt(hart) + H_HOST_LENGTH) : 0;

export const tetoHartExitCode = (memory: TetoMemory, hart: U32): I32 =>
  validHart(memory, hart) ? loadI32(memory, hartAt(hart) + H_EXIT_CODE) : -1;

const setX = (memory: TetoMemory, hart: U32, register: U32, value: I64): void => {
  if (register !== 0) storeI64(memory, regAt(hart, register), sx(value, 64));
};

const x = (memory: TetoMemory, hart: U32, register: U32): I64 =>
  register === 0 ? 0n : loadI64(memory, regAt(hart, register));

const f = (memory: TetoMemory, hart: U32, register: U32): U64 =>
  loadU64(memory, floatRegAt(hart, register));

const setF = (memory: TetoMemory, hart: U32, register: U32, value: U64): void =>
  storeU64(memory, floatRegAt(hart, register), value);

const setPc = (memory: TetoMemory, hart: U32, value: U64): void =>
  storeU64(memory, hartAt(hart) + H_PC, ux(value));

const guestRange = (
  memory: TetoMemory,
  hart: U32,
  address: U64,
  size: U32,
): boolean => {
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return false;
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  return address < top && ux(word(size)) <= top - address;
};

const guestAllowed = (
  memory: TetoMemory,
  hart: U32,
  address: U64,
  size: U32,
  permission: U32,
): boolean => {
  if (!guestRange(memory, hart, address, size)) return false;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return false;
  const end = address + ux(word(size));
  const count = loadU32(memory, proc + P_SEGMENT_COUNT);
  const table = loadU32(memory, proc + P_SEGMENT_TABLE);
  let index: U32 = 0;
  while (index < count) {
    const segment = table + index * TETO_SEGMENT_STRIDE;
    if (address >= loadU64(memory, segment + S_ADDRESS) && end <= loadU64(memory, segment + S_END)) {
      return (loadU32(memory, segment + S_FLAGS) & permission) === permission;
    }
    index += 1;
  }
  if ((permission & TETO_SEGMENT_EXECUTE) !== 0) return false;
  const stack = atomicLoadU64(memory, proc + P_STACK_BOTTOM);
  if (stack !== 0n && address >= stack && end <= atomicLoadU64(memory, proc + P_VIRTUAL_TOP)) return true;
  const heap = atomicLoadU64(memory, proc + P_BRK_BASE);
  if (heap !== 0n && address >= heap && end <= atomicLoadU64(memory, proc + P_BRK)) return true;
  const mapCount = loadU32(memory, proc + P_MAP_COUNT);
  const mapTable = loadU32(memory, proc + P_MAP_TABLE);
  index = 0;
  while (index < mapCount) {
    const mapping = mapTable + index * TETO_MAP_STRIDE;
    if (address >= loadU64(memory, mapping + M_ADDRESS) && end <= loadU64(memory, mapping + M_END)) {
      return (loadU32(memory, mapping + M_PROTECTION) & permission) === permission;
    }
    index += 1;
  }
  return false;
};

const pageHash = (page: U64, capacity: U32): U32 =>
  wordToU32((page ^ page >> 32n) * 0x9e3779b1n) & (capacity - 1);

const guestPage = (memory: TetoMemory, hart: U32, address: U64, create: boolean): Ptr => {
  if (!guestRange(memory, hart, address, 1)) return INVALID_POINTER;
  const state = hartAt(hart);
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return INVALID_POINTER;
  const table = wordToU32(word(atomicLoadI32(memory, proc + P_PAGE_TABLE)));
  const capacity = wordToU32(word(atomicLoadI32(memory, proc + P_PAGE_CAPACITY)));
  const page = address >> 16n;
  const key = page + 1n;
  let slot = pageHash(page, capacity);
  let probe: U32 = 0;
  while (probe < capacity) {
    const entry = table + slot * TETO_PAGE_ENTRY_SIZE;
    const found = atomicLoadU64(memory, entry);
    if (found === key) return loadU32(memory, entry + 8);
    if (found === 0n) {
      if (!create) return UNMAPPED_POINTER;
      const lockAt = TETO_CONTROL_BASE + C_MEMORY_LOCK;
      if (!acquire(memory, lockAt)) return INVALID_POINTER;
      const recheck = atomicLoadU64(memory, entry);
      if (recheck === key) {
        const existing = loadU32(memory, entry + 8);
        release(memory, lockAt);
        return existing;
      }
      if (recheck !== 0n) {
        release(memory, lockAt);
        slot = (slot + 1) & (capacity - 1);
        probe += 1;
        continue;
      }
      const frame = loadU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_NEXT);
      const end = loadU32(memory, TETO_CONTROL_BASE + C_IMAGE_TOP);
      if (frame > end || TETO_GUEST_PAGE_SIZE > end - frame) {
        release(memory, lockAt);
        return INVALID_POINTER;
      }
      fill(memory, frame, TETO_GUEST_PAGE_SIZE, 0);
      storeU32(memory, entry + 8, frame);
      storeU32(memory, entry + 12, 0);
      storeU32(memory, TETO_CONTROL_BASE + C_PHYSICAL_NEXT, frame + TETO_GUEST_PAGE_SIZE);
      const pageCount = wordToU32(word(atomicLoadI32(memory, proc + P_PAGE_COUNT))) + 1;
      atomicStoreI32(memory, proc + P_PAGE_COUNT, wordToI32(word(pageCount)));
      storeU32(memory, state + H_PAGE_COUNT, pageCount);
      atomicStoreU64(memory, entry, key);
      release(memory, lockAt);
      return frame;
    }
    slot = (slot + 1) & (capacity - 1);
    probe += 1;
  }
  return INVALID_POINTER;
};

const clearMappedRange = (memory: TetoMemory, proc: Ptr, start: U64, end: U64): void => {
  const table = loadU32(memory, proc + P_PAGE_TABLE);
  const capacity = loadU32(memory, proc + P_PAGE_CAPACITY);
  let slot: U32 = 0;
  while (slot < capacity) {
    const entry = table + slot * TETO_PAGE_ENTRY_SIZE;
    const key = atomicLoadU64(memory, entry);
    if (key !== 0n) {
      const page = (key - 1n) << 16n;
      const pageEnd = page + ux(word(TETO_GUEST_PAGE_SIZE));
      if (start < pageEnd && end > page) {
        const low = start > page ? start : page;
        const high = end < pageEnd ? end : pageEnd;
        fill(memory, loadU32(memory, entry + 8) + wordToU32(low - page), wordToU32(high - low), 0);
      }
    }
    slot += 1;
  }
};

const mapAt = (memory: TetoMemory, proc: Ptr, index: U32): Ptr =>
  loadU32(memory, proc + P_MAP_TABLE) + index * TETO_MAP_STRIDE;

const copyMap = (memory: TetoMemory, to: Ptr, from: Ptr): void => {
  storeU64(memory, to + M_ADDRESS, loadU64(memory, from + M_ADDRESS));
  storeU64(memory, to + M_END, loadU64(memory, from + M_END));
  storeU32(memory, to + M_PROTECTION, loadU32(memory, from + M_PROTECTION));
  storeU32(memory, to + M_FLAGS, loadU32(memory, from + M_FLAGS));
  storeI32(memory, to + M_FILE_DESCRIPTOR, loadI32(memory, from + M_FILE_DESCRIPTOR));
  storeU64(memory, to + M_FILE_OFFSET, loadU64(memory, from + M_FILE_OFFSET));
  storeU32(memory, to + M_BACKING, loadU32(memory, from + M_BACKING));
  storeU32(memory, to + M_BACKING + 4, 0);
};

const mappingConflict = (memory: TetoMemory, proc: Ptr, address: U64, end: U64): boolean => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  const stack = atomicLoadU64(memory, proc + P_STACK_BOTTOM);
  const heap = atomicLoadU64(memory, proc + P_BRK);
  if (address < (heap + MAP_GUARD + MAP_PAGE - 1n & -MAP_PAGE) || end <= address || end > top ||
      stack <= MAP_GUARD || end >= stack - MAP_GUARD) return true;
  const count = loadU32(memory, proc + P_MAP_COUNT);
  let index: U32 = 0;
  while (index < count) {
    const mapping = mapAt(memory, proc, index);
    if (address < loadU64(memory, mapping + M_END) && end > loadU64(memory, mapping + M_ADDRESS)) return true;
    index += 1;
  }
  return false;
};

const anonymousMap = (memory: TetoMemory, proc: Ptr, address: U64, length: U64, protection: U64, flagsWide: U64): I64 => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  if (length === 0n || length > top || protection > 7n || flagsWide > 0x7fffffffn) return -22n;
  const flags = wordToU32(flagsWide);
  const kind = flags & 3;
  if ((flags & 0x20) === 0 || (kind !== 1 && kind !== 2) || (flags & ~0x100033) !== 0) return -22n;
  const size = length + MAP_PAGE - 1n & -MAP_PAGE;
  if (size === 0n || size > top) return -12n;
  const fixed = (flags & 0x100010) !== 0;
  let candidate = address;
  if (fixed) {
    if ((candidate & (MAP_PAGE - 1n)) !== 0n || candidate > top || size > top - candidate ||
        mappingConflict(memory, proc, candidate, candidate + size)) return -12n;
  } else {
    if (candidate !== 0n) {
      if (candidate > top - MAP_PAGE + 1n) candidate = 0n;
      else candidate = candidate + MAP_PAGE - 1n & -MAP_PAGE;
    }
    if (candidate === 0n || candidate > top || size > top - candidate ||
        mappingConflict(memory, proc, candidate, candidate + size)) {
      const minimum = atomicLoadU64(memory, proc + P_BRK) + MAP_SPACING + MAP_PAGE - 1n & -MAP_PAGE;
      candidate = atomicLoadU64(memory, proc + P_MAP_NEXT);
      if (candidate < minimum || candidate > top || size > top - candidate) candidate = minimum;
      let attempts: U32 = 0;
      const capacity = loadU32(memory, proc + P_MAP_CAPACITY);
      while (attempts <= capacity && (candidate > top || size > top - candidate ||
          mappingConflict(memory, proc, candidate, candidate + size))) {
        if (candidate > top - MAP_SPACING) return -12n;
        candidate = candidate + MAP_SPACING + MAP_PAGE - 1n & -MAP_PAGE;
        attempts += 1;
      }
      if (candidate > top || size > top - candidate || mappingConflict(memory, proc, candidate, candidate + size)) return -12n;
    }
  }
  const count = loadU32(memory, proc + P_MAP_COUNT);
  if (count >= loadU32(memory, proc + P_MAP_CAPACITY)) return -12n;
  clearMappedRange(memory, proc, candidate, candidate + size);
  const mapping = mapAt(memory, proc, count);
  fill(memory, mapping, TETO_MAP_STRIDE, 0);
  storeU64(memory, mapping + M_ADDRESS, candidate);
  storeU64(memory, mapping + M_END, candidate + size);
  storeU32(memory, mapping + M_PROTECTION, wordToU32(protection));
  storeU32(memory, mapping + M_FLAGS, flags);
  storeI32(memory, mapping + M_FILE_DESCRIPTOR, -1);
  storeU32(memory, mapping + M_BACKING, TETO_MAP_BACKING_ANONYMOUS);
  atomicStoreI32(memory, proc + P_MAP_COUNT, wordToI32(word(count + 1)));
  const next = candidate + size + MAP_PAGE - 1n & -MAP_PAGE;
  if (next > atomicLoadU64(memory, proc + P_MAP_NEXT)) atomicStoreU64(memory, proc + P_MAP_NEXT, next);
  return sx(candidate, 64);
};

const anonymousUnmap = (memory: TetoMemory, proc: Ptr, address: U64, length: U64): I64 => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  if (length === 0n || (address & (MAP_PAGE - 1n)) !== 0n || address >= top || length > top - address) return -22n;
  const size = length + MAP_PAGE - 1n & -MAP_PAGE;
  if (size === 0n || size > top - address) return -22n;
  const end = address + size;
  let count = loadU32(memory, proc + P_MAP_COUNT);
  const capacity = loadU32(memory, proc + P_MAP_CAPACITY);
  let index: U32 = 0;
  let splits: U32 = 0;
  let hit = false;
  while (index < count) {
    const mapping = mapAt(memory, proc, index);
    const start = loadU64(memory, mapping + M_ADDRESS);
    const stop = loadU64(memory, mapping + M_END);
    if (address < stop && end > start) {
      hit = true;
      if (address > start && end < stop) splits += 1;
    }
    index += 1;
  }
  if (!hit) return MAP_NOT_OWNED;
  if (splits > capacity - count) return -12n;
  index = 0;
  while (index < count) {
    const mapping = mapAt(memory, proc, index);
    const start = loadU64(memory, mapping + M_ADDRESS);
    const stop = loadU64(memory, mapping + M_END);
    if (address >= stop || end <= start) {
      index += 1;
      continue;
    }
    const low = address > start ? address : start;
    const high = end < stop ? end : stop;
    clearMappedRange(memory, proc, low, high);
    if (address <= start && end >= stop) {
      let move = index;
      while (move + 1 < count) {
        copyMap(memory, mapAt(memory, proc, move), mapAt(memory, proc, move + 1));
        move += 1;
      }
      count -= 1;
      fill(memory, mapAt(memory, proc, count), TETO_MAP_STRIDE, 0);
      continue;
    }
    if (address <= start) {
      storeU64(memory, mapping + M_ADDRESS, end);
      storeU64(memory, mapping + M_FILE_OFFSET, loadU64(memory, mapping + M_FILE_OFFSET) + end - start);
      index += 1;
      continue;
    }
    if (end >= stop) {
      storeU64(memory, mapping + M_END, address);
      index += 1;
      continue;
    }
    const right = mapAt(memory, proc, count);
    copyMap(memory, right, mapping);
    storeU64(memory, mapping + M_END, address);
    storeU64(memory, right + M_ADDRESS, end);
    storeU64(memory, right + M_FILE_OFFSET, loadU64(memory, mapping + M_FILE_OFFSET) + end - start);
    count += 1;
    index += 1;
  }
  atomicStoreI32(memory, proc + P_MAP_COUNT, wordToI32(word(count)));
  return 0n;
};

const mappingsCover = (memory: TetoMemory, proc: Ptr, address: U64, end: U64): boolean => {
  const count = loadU32(memory, proc + P_MAP_COUNT);
  let cursor = address;
  while (cursor < end) {
    let found = false;
    let index: U32 = 0;
    while (index < count) {
      const mapping = mapAt(memory, proc, index);
      const start = loadU64(memory, mapping + M_ADDRESS);
      const stop = loadU64(memory, mapping + M_END);
      if (cursor >= start && cursor < stop) {
        cursor = stop < end ? stop : end;
        found = true;
        break;
      }
      index += 1;
    }
    if (!found) return false;
  }
  return true;
};

const protectMappings = (memory: TetoMemory, proc: Ptr, address: U64, length: U64, protection: U64): I64 => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  if (length === 0n || protection > 7n || (address & (MAP_PAGE - 1n)) !== 0n ||
      address >= top || length > top - address) return -22n;
  const size = length + MAP_PAGE - 1n & -MAP_PAGE;
  if (size === 0n || size > top - address) return -22n;
  const end = address + size;
  const original = loadU32(memory, proc + P_MAP_COUNT);
  let hit = false;
  let needed: U32 = 0;
  let index: U32 = 0;
  while (index < original) {
    const mapping = mapAt(memory, proc, index);
    const start = loadU64(memory, mapping + M_ADDRESS);
    const stop = loadU64(memory, mapping + M_END);
    if (address < stop && end > start) {
      hit = true;
      const low = address > start ? address : start;
      const high = end < stop ? end : stop;
      if (low > start) needed += 1;
      if (high < stop) needed += 1;
    }
    index += 1;
  }
  if (!hit) return MAP_NOT_OWNED;
  if (!mappingsCover(memory, proc, address, end)) return -12n;
  const capacity = loadU32(memory, proc + P_MAP_CAPACITY);
  if (needed > capacity - original) return -12n;
  let count = original;
  index = 0;
  while (index < original) {
    const mapping = mapAt(memory, proc, index);
    const start = loadU64(memory, mapping + M_ADDRESS);
    const stop = loadU64(memory, mapping + M_END);
    if (address >= stop || end <= start) {
      index += 1;
      continue;
    }
    const low = address > start ? address : start;
    const high = end < stop ? end : stop;
    const oldOffset = loadU64(memory, mapping + M_FILE_OFFSET);
    if (low === start && high === stop) {
      storeU32(memory, mapping + M_PROTECTION, wordToU32(protection));
    } else if (low === start) {
      const right = mapAt(memory, proc, count);
      copyMap(memory, right, mapping);
      storeU64(memory, right + M_ADDRESS, high);
      storeU64(memory, right + M_FILE_OFFSET, oldOffset + high - start);
      storeU64(memory, mapping + M_END, high);
      storeU32(memory, mapping + M_PROTECTION, wordToU32(protection));
      count += 1;
    } else if (high === stop) {
      const changed = mapAt(memory, proc, count);
      copyMap(memory, changed, mapping);
      storeU64(memory, changed + M_ADDRESS, low);
      storeU64(memory, changed + M_FILE_OFFSET, oldOffset + low - start);
      storeU32(memory, changed + M_PROTECTION, wordToU32(protection));
      storeU64(memory, mapping + M_END, low);
      count += 1;
    } else {
      const changed = mapAt(memory, proc, count);
      const right = mapAt(memory, proc, count + 1);
      copyMap(memory, changed, mapping);
      copyMap(memory, right, mapping);
      storeU64(memory, mapping + M_END, low);
      storeU64(memory, changed + M_ADDRESS, low);
      storeU64(memory, changed + M_END, high);
      storeU64(memory, changed + M_FILE_OFFSET, oldOffset + low - start);
      storeU32(memory, changed + M_PROTECTION, wordToU32(protection));
      storeU64(memory, right + M_ADDRESS, high);
      storeU64(memory, right + M_FILE_OFFSET, oldOffset + high - start);
      count += 2;
    }
    index += 1;
  }
  atomicStoreI32(memory, proc + P_MAP_COUNT, wordToI32(word(count)));
  return 0n;
};

const mappingConflictExcept = (memory: TetoMemory, proc: Ptr, address: U64, end: U64, except: U32): boolean => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  const stack = atomicLoadU64(memory, proc + P_STACK_BOTTOM);
  const heap = atomicLoadU64(memory, proc + P_BRK);
  if (address < (heap + MAP_GUARD + MAP_PAGE - 1n & -MAP_PAGE) || end <= address || end > top ||
      stack <= MAP_GUARD || end >= stack - MAP_GUARD) return true;
  const count = loadU32(memory, proc + P_MAP_COUNT);
  let index: U32 = 0;
  while (index < count) {
    if (index !== except) {
      const mapping = mapAt(memory, proc, index);
      if (address < loadU64(memory, mapping + M_END) && end > loadU64(memory, mapping + M_ADDRESS)) return true;
    }
    index += 1;
  }
  return false;
};

const copyAllocatedRange = (memory: TetoMemory, hart: U32, proc: Ptr, source: U64, destination: U64, length: U64): boolean => {
  const table = loadU32(memory, proc + P_PAGE_TABLE);
  const capacity = loadU32(memory, proc + P_PAGE_CAPACITY);
  const sourceEnd = source + length;
  let slot: U32 = 0;
  while (slot < capacity) {
    const entry = table + slot * TETO_PAGE_ENTRY_SIZE;
    const key = atomicLoadU64(memory, entry);
    if (key !== 0n) {
      const page = (key - 1n) << 16n;
      const pageEnd = page + ux(word(TETO_GUEST_PAGE_SIZE));
      if (source < pageEnd && sourceEnd > page) {
        const low = source > page ? source : page;
        const high = sourceEnd < pageEnd ? sourceEnd : pageEnd;
        const sourceFrame = loadU32(memory, entry + 8);
        let copied: U32 = 0;
        const amount = wordToU32(high - low);
        while (copied < amount) {
          const target = destination + low - source + ux(word(copied));
          const targetFrame = guestPage(memory, hart, target, true);
          if (targetFrame === INVALID_POINTER || targetFrame === UNMAPPED_POINTER) return false;
          const within = wordToU32(target & 0xffffn);
          const room = TETO_GUEST_PAGE_SIZE - within;
          const part = room < amount - copied ? room : amount - copied;
          copyMemory(memory, targetFrame + within, sourceFrame + wordToU32(low - page) + copied, part);
          copied += part;
        }
      }
    }
    slot += 1;
  }
  return true;
};

const remapAnonymous = (memory: TetoMemory, hart: U32, proc: Ptr, oldAddress: U64, oldLength: U64,
  newLength: U64, flagsWide: U64, fixedAddress: U64): I64 => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  if ((oldAddress & (MAP_PAGE - 1n)) !== 0n || oldLength === 0n || newLength === 0n ||
      oldLength > top || newLength > top || flagsWide > 1n || fixedAddress !== 0n) return -22n;
  const oldSize = oldLength + MAP_PAGE - 1n & -MAP_PAGE;
  const newSize = newLength + MAP_PAGE - 1n & -MAP_PAGE;
  if (oldSize === 0n || newSize === 0n || oldAddress > top || oldSize > top - oldAddress) return -22n;
  const count = loadU32(memory, proc + P_MAP_COUNT);
  let index: U32 = 0;
  let found = count;
  while (index < count) {
    const mapping = mapAt(memory, proc, index);
    if (loadU64(memory, mapping + M_ADDRESS) === oldAddress && loadU64(memory, mapping + M_END) === oldAddress + oldSize &&
        loadU32(memory, mapping + M_BACKING) === TETO_MAP_BACKING_ANONYMOUS) found = index;
    index += 1;
  }
  if (found === count) return MAP_NOT_OWNED;
  const mapping = mapAt(memory, proc, found);
  if (newSize === oldSize) return sx(oldAddress, 64);
  if (newSize < oldSize) {
    clearMappedRange(memory, proc, oldAddress + newSize, oldAddress + oldSize);
    storeU64(memory, mapping + M_END, oldAddress + newSize);
    return sx(oldAddress, 64);
  }
  const extended = oldAddress + newSize;
  if (!mappingConflictExcept(memory, proc, oldAddress, extended, found)) {
    clearMappedRange(memory, proc, oldAddress + oldSize, extended);
    storeU64(memory, mapping + M_END, extended);
    if (extended > atomicLoadU64(memory, proc + P_MAP_NEXT)) atomicStoreU64(memory, proc + P_MAP_NEXT, extended);
    return sx(oldAddress, 64);
  }
  if ((wordToU32(flagsWide) & 1) === 0) return -12n;
  const mapFlags = loadU32(memory, mapping + M_FLAGS) & ~0x100010;
  const moved = anonymousMap(memory, proc, 0n, newSize, ux(word(loadU32(memory, mapping + M_PROTECTION))), ux(word(mapFlags)));
  if (moved < 0n) return moved;
  const destination = ux(moved);
  if (!copyAllocatedRange(memory, hart, proc, oldAddress, destination, oldSize)) {
    anonymousUnmap(memory, proc, destination, newSize);
    return -12n;
  }
  const removed = anonymousUnmap(memory, proc, oldAddress, oldSize);
  if (removed !== 0n) return -12n;
  return sx(destination, 64);
};

const syncAnonymous = (memory: TetoMemory, proc: Ptr, address: U64, length: U64, flagsWide: U64): I64 => {
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  if (length === 0n || (address & (MAP_PAGE - 1n)) !== 0n || address >= top || length > top - address ||
      flagsWide > 7n || (wordToU32(flagsWide) & 5) === 0) return -22n;
  const size = length + MAP_PAGE - 1n & -MAP_PAGE;
  if (size === 0n || size > top - address) return -22n;
  const end = address + size;
  if (!mappingsCover(memory, proc, address, end)) return MAP_NOT_OWNED;
  const count = loadU32(memory, proc + P_MAP_COUNT);
  let index: U32 = 0;
  while (index < count) {
    const mapping = mapAt(memory, proc, index);
    if (address < loadU64(memory, mapping + M_END) && end > loadU64(memory, mapping + M_ADDRESS) &&
        loadU32(memory, mapping + M_BACKING) !== TETO_MAP_BACKING_ANONYMOUS) return MAP_NOT_OWNED;
    index += 1;
  }
  return 0n;
};

export const tetoGuestPage = (memory: TetoMemory, hart: U32, address: U64, create: boolean): Ptr =>
  validHart(memory, hart) ? guestPage(memory, hart, address, create) : INVALID_POINTER;

const guestPointer = (memory: TetoMemory, hart: U32, address: U64, size: U32, create: boolean): Ptr => {
  if (!guestRange(memory, hart, address, size)) return INVALID_POINTER;
  const offset = wordToU32(address & 0xffffn);
  if (size > TETO_GUEST_PAGE_SIZE - offset) return INVALID_POINTER;
  const page = guestPage(memory, hart, address, create);
  if (page === INVALID_POINTER || page === UNMAPPED_POINTER) return page;
  return page + offset;
};

const guestLoadU8 = (memory: TetoMemory, hart: U32, address: U64): I32 => {
  if (!guestRange(memory, hart, address, 1)) return -1;
  const pointer = guestPointer(memory, hart, address, 1, false);
  if (pointer === INVALID_POINTER) return -1;
  return pointer === UNMAPPED_POINTER ? 0 : loadU8(memory, pointer);
};

const guestLoadU64 = (memory: TetoMemory, hart: U32, address: U64, size: U32): U64 => {
  let value: U64 = 0n;
  let index: U32 = 0;
  while (index < size) {
    const byte = guestLoadU8(memory, hart, address + ux(word(index)));
    if (byte < 0) return 0n;
    value |= ux(word(byte)) << word(index * 8);
    index += 1;
  }
  return value;
};

const guestStoreU64 = (memory: TetoMemory, hart: U32, address: U64, value: U64, size: U32): boolean => {
  if (!guestRange(memory, hart, address, size)) return false;
  let index: U32 = 0;
  while (index < size) {
    const pointer = guestPointer(memory, hart, address + ux(word(index)), 1, true);
    if (pointer === INVALID_POINTER || pointer === UNMAPPED_POINTER) return false;
    storeU8(memory, pointer, sx(value >> word(index * 8), 64));
    index += 1;
  }
  return true;
};

const guestWritable = (memory: TetoMemory, hart: U32, address: U64, size: U32): boolean => {
  if (!guestRange(memory, hart, address, size)) return false;
  let offset: U32 = 0;
  while (offset < size) {
    const current = address + ux(word(offset));
    const page = guestPage(memory, hart, current, true);
    if (page === INVALID_POINTER || page === UNMAPPED_POINTER) return false;
    const within = wordToU32(current & 0xffffn);
    const left = TETO_GUEST_PAGE_SIZE - within;
    offset += left < size - offset ? left : size - offset;
  }
  return true;
};

export const tetoImageBegin = (
  memory: TetoMemory,
  hart: U32,
  virtualTop: U64,
  entry: U64,
  phdr: U64,
  phent: U32,
  phnum: U32,
): I32 => {
  if (!validHart(memory, hart) || virtualTop < 1024n * 1024n ||
      virtualTop > 0x0000ffffffffffffn || entry < 0x10000n || entry >= virtualTop ||
      phdr >= virtualTop && phdr !== 0n) return TETO_THX_MEMORY;
  const proc = processForHart(memory, hart);
  if (proc === INVALID_POINTER) return TETO_THX_MEMORY;
  const pageTable = loadU32(memory, proc + P_PAGE_TABLE);
  const pageCapacity = loadU32(memory, proc + P_PAGE_CAPACITY);
  const segmentTable = loadU32(memory, proc + P_SEGMENT_TABLE);
  const segmentCapacity = loadU32(memory, TETO_CONTROL_BASE + C_SEGMENT_CAPACITY);
  const mapTable = loadU32(memory, proc + P_MAP_TABLE);
  const mapCapacity = loadU32(memory, proc + P_MAP_CAPACITY);
  fill(memory, pageTable, pageCapacity * TETO_PAGE_ENTRY_SIZE, 0);
  fill(memory, segmentTable, segmentCapacity * TETO_SEGMENT_STRIDE, 0);
  fill(memory, mapTable, mapCapacity * TETO_MAP_STRIDE, 0);
  atomicStoreI32(memory, proc + P_PAGE_COUNT, 0);
  atomicStoreI32(memory, proc + P_SEGMENT_COUNT, 0);
  atomicStoreI32(memory, proc + P_MAP_COUNT, 0);
  atomicStoreU64(memory, proc + P_MAP_NEXT, 0x4000000000n);
  atomicStoreU64(memory, proc + P_VIRTUAL_TOP, virtualTop);
  atomicStoreU64(memory, proc + P_IMAGE_FLOOR, 0n);
  atomicStoreU64(memory, proc + P_IMAGE_ENTRY, entry);
  atomicStoreU64(memory, proc + P_BRK_BASE, 0n);
  atomicStoreU64(memory, proc + P_BRK, 0n);
  atomicStoreU64(memory, proc + P_PHDR, phdr);
  atomicStoreI32(memory, proc + P_PHENT, wordToI32(word(phent)));
  atomicStoreI32(memory, proc + P_PHNUM, wordToI32(word(phnum)));
  const state = hartAt(hart);
  storeU64(memory, state + H_VIRTUAL_TOP, virtualTop);
  storeU64(memory, state + H_PC, entry);
  storeU64(memory, state + H_IMAGE_FLOOR, 0n);
  storeU32(memory, state + H_PAGE_COUNT, 0);
  storeI64(memory, state + H_RESERVATION, NO_RESERVATION);
  return TETO_THX_OK;
};

export const tetoImageSegment = (
  memory: TetoMemory,
  hart: U32,
  nameHash: U32,
  nameLength: U32,
  address: U64,
  size: U64,
  flags: U32,
  imageAt: Ptr,
  length: U32,
): I32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER || length > size || flags > 7 ||
      !tetoImageContains(memory, imageAt, length)) return TETO_THX_SECTION;
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  const end = address + size;
  if (address < 0x10000n || end < address || end > top) return TETO_THX_SECTION;
  const count = loadU32(memory, proc + P_SEGMENT_COUNT);
  const capacity = loadU32(memory, TETO_CONTROL_BASE + C_SEGMENT_CAPACITY);
  if (count >= capacity) return TETO_THX_SECTION;
  const table = loadU32(memory, proc + P_SEGMENT_TABLE);
  let index: U32 = 0;
  while (index < count) {
    const segment = table + index * TETO_SEGMENT_STRIDE;
    const left = loadU64(memory, segment + S_ADDRESS);
    const right = loadU64(memory, segment + S_END);
    if (address < right && end > left) return TETO_THX_SECTION;
    if (loadU32(memory, segment + S_NAME_HASH) === nameHash &&
        loadU32(memory, segment + S_NAME_LENGTH) === nameLength) return TETO_THX_SECTION;
    index += 1;
  }
  if (length > 0 && !guestWritable(memory, hart, address, length)) return TETO_THX_MEMORY;
  let copied: U32 = 0;
  while (copied < length) {
    const guest = address + ux(word(copied));
    const frame = guestPage(memory, hart, guest, false);
    if (frame === INVALID_POINTER || frame === UNMAPPED_POINTER) return TETO_THX_MEMORY;
    const within = wordToU32(guest & 0xffffn);
    const remaining = length - copied;
    const room = TETO_GUEST_PAGE_SIZE - within;
    const amount = room < remaining ? room : remaining;
    let offset: U32 = 0;
    while (offset < amount) {
      storeU8(memory, frame + within + offset, word(loadU8(memory, imageAt + copied + offset)));
      offset += 1;
    }
    copied += amount;
  }
  const segment = table + count * TETO_SEGMENT_STRIDE;
  storeU64(memory, segment + S_ADDRESS, address);
  storeU64(memory, segment + S_END, end);
  storeU32(memory, segment + S_FLAGS, flags);
  storeU32(memory, segment + S_NAME_HASH, nameHash);
  storeU32(memory, segment + S_NAME_LENGTH, nameLength);
  atomicStoreI32(memory, proc + P_SEGMENT_COUNT, wordToI32(word(count + 1)));
  const floor = atomicLoadU64(memory, proc + P_IMAGE_FLOOR);
  if (end > floor) {
    atomicStoreU64(memory, proc + P_IMAGE_FLOOR, end);
    storeU64(memory, hartAt(hart) + H_IMAGE_FLOOR, end);
  }
  return TETO_THX_OK;
};

export const tetoImageFinish = (memory: TetoMemory, hart: U32, imageBytes: U32): I32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER) return TETO_THX_MEMORY;
  const count = loadU32(memory, proc + P_SEGMENT_COUNT);
  const table = loadU32(memory, proc + P_SEGMENT_TABLE);
  const entry = atomicLoadU64(memory, proc + P_IMAGE_ENTRY);
  let index: U32 = 0;
  let executable = false;
  while (index < count) {
    const segment = table + index * TETO_SEGMENT_STRIDE;
    if ((loadU32(memory, segment + S_FLAGS) & TETO_SEGMENT_EXECUTE) !== 0 &&
        entry >= loadU64(memory, segment + S_ADDRESS) && entry < loadU64(memory, segment + S_END)) executable = true;
    index += 1;
  }
  if (!executable) return TETO_THX_SECTION;
  const floor = atomicLoadU64(memory, proc + P_IMAGE_FLOOR);
  const heap = floor + 4095n & -4096n;
  atomicStoreU64(memory, proc + P_BRK_BASE, floor);
  atomicStoreU64(memory, proc + P_BRK, heap);
  bump(memory, hartAt(hart) + H_IMAGE_LOADS);
  atomicAddU64(memory, hartAt(hart) + H_IMAGE_BYTES, ux(word(imageBytes)));
  return TETO_THX_OK;
};

export const tetoStackPrepare = (memory: TetoMemory, hart: U32, bottom: U64, stackPointer: U64): I32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER) return TETO_START_MEMORY;
  const top = atomicLoadU64(memory, proc + P_VIRTUAL_TOP);
  if (bottom >= stackPointer || stackPointer >= top || top - stackPointer > 0x7fffffffn) return TETO_START_RANGE;
  const length = wordToU32(top - stackPointer);
  if (!guestWritable(memory, hart, stackPointer, length)) return TETO_START_MEMORY;
  let cleared: U32 = 0;
  while (cleared < length) {
    const guest = stackPointer + ux(word(cleared));
    const frame = guestPage(memory, hart, guest, false);
    if (frame === INVALID_POINTER || frame === UNMAPPED_POINTER) return TETO_START_MEMORY;
    const within = wordToU32(guest & 0xffffn);
    const remaining = length - cleared;
    const room = TETO_GUEST_PAGE_SIZE - within;
    const amount = room < remaining ? room : remaining;
    fill(memory, frame + within, amount, 0);
    cleared += amount;
  }
  atomicStoreU64(memory, proc + P_STACK_BOTTOM, bottom);
  atomicStoreU64(memory, proc + P_STACK_POINTER, stackPointer);
  storeU64(memory, hartAt(hart) + H_STACK_BOTTOM, bottom);
  storeU64(memory, hartAt(hart) + H_STACK_POINTER, stackPointer);
  return TETO_START_OK;
};

export const tetoStackCopy = (
  memory: TetoMemory,
  hart: U32,
  destination: U64,
  source: Ptr,
  length: U32,
): I32 => {
  if (!tetoImageContains(memory, source, length)) return TETO_START_FORMAT;
  if (length > 0 && !guestWritable(memory, hart, destination, length)) return TETO_START_MEMORY;
  let copied: U32 = 0;
  while (copied < length) {
    const guest = destination + ux(word(copied));
    const frame = guestPage(memory, hart, guest, false);
    if (frame === INVALID_POINTER || frame === UNMAPPED_POINTER) return TETO_START_MEMORY;
    const within = wordToU32(guest & 0xffffn);
    const remaining = length - copied;
    const room = TETO_GUEST_PAGE_SIZE - within;
    const amount = room < remaining ? room : remaining;
    let offset: U32 = 0;
    while (offset < amount) {
      storeU8(memory, frame + within + offset, word(loadU8(memory, source + copied + offset)));
      offset += 1;
    }
    copied += amount;
  }
  return TETO_START_OK;
};

export const tetoStackStoreU64 = (memory: TetoMemory, hart: U32, address: U64, value: U64): I32 =>
  guestStoreU64(memory, hart, address, value, 8) ? TETO_START_OK : TETO_START_MEMORY;

export const tetoStackAux = (memory: TetoMemory, hart: U32, at: U64, random: U64, exec: U64): I32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER) return TETO_START_MEMORY;
  const ruid = u32word(word(atomicLoadI32(memory, proc + P_RUID)));
  const euid = u32word(word(atomicLoadI32(memory, proc + P_EUID)));
  const rgid = u32word(word(atomicLoadI32(memory, proc + P_RGID)));
  const egid = u32word(word(atomicLoadI32(memory, proc + P_EGID)));
  const secure = ruid !== euid || rgid !== egid ? 1n : 0n;
  let cursor = at;
  if (!guestStoreU64(memory, hart, cursor, 3n, 8) || !guestStoreU64(memory, hart, cursor + 8n, atomicLoadU64(memory, proc + P_PHDR), 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 4n, 8) || !guestStoreU64(memory, hart, cursor + 8n, u32word(word(atomicLoadI32(memory, proc + P_PHENT))), 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 5n, 8) || !guestStoreU64(memory, hart, cursor + 8n, u32word(word(atomicLoadI32(memory, proc + P_PHNUM))), 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 6n, 8) || !guestStoreU64(memory, hart, cursor + 8n, 4096n, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 7n, 8) || !guestStoreU64(memory, hart, cursor + 8n, 0n, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 8n, 8) || !guestStoreU64(memory, hart, cursor + 8n, 0n, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 9n, 8) || !guestStoreU64(memory, hart, cursor + 8n, atomicLoadU64(memory, proc + P_IMAGE_ENTRY), 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 11n, 8) || !guestStoreU64(memory, hart, cursor + 8n, ruid, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 12n, 8) || !guestStoreU64(memory, hart, cursor + 8n, euid, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 13n, 8) || !guestStoreU64(memory, hart, cursor + 8n, rgid, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 14n, 8) || !guestStoreU64(memory, hart, cursor + 8n, egid, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 23n, 8) || !guestStoreU64(memory, hart, cursor + 8n, secure, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 25n, 8) || !guestStoreU64(memory, hart, cursor + 8n, random, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 31n, 8) || !guestStoreU64(memory, hart, cursor + 8n, exec, 8)) return TETO_START_MEMORY;
  cursor += 16n;
  if (!guestStoreU64(memory, hart, cursor, 0n, 8) || !guestStoreU64(memory, hart, cursor + 8n, 0n, 8)) return TETO_START_MEMORY;
  return TETO_START_OK;
};

export const tetoStackFinish = (memory: TetoMemory, hart: U32, stackPointer: U64): I32 => {
  const proc = validHart(memory, hart) ? processForHart(memory, hart) : INVALID_POINTER;
  if (proc === INVALID_POINTER || stackPointer !== atomicLoadU64(memory, proc + P_STACK_POINTER)) return TETO_START_MEMORY;
  setX(memory, hart, 2, sx(stackPointer, 64));
  bump(memory, hartAt(hart) + H_STARTUP_LOADS);
  return TETO_START_OK;
};

const fault = (memory: TetoMemory, hart: U32, code: I32, instruction: U32): I32 => {
  const at = hartAt(hart);
  storeI32(memory, at + H_FAULT, code);
  storeU32(memory, at + H_LAST_INSTRUCTION, instruction);
  atomicStoreI32(memory, at + H_STATUS, TETO_HART_FAULTED);
  return TETO_BATCH_FAULT;
};

const immediateI = (instruction: U32): I64 => sx(word(instruction >>> 20), 12);
const immediateS = (instruction: U32): I64 =>
  sx(word((instruction >>> 25) << 5 | instruction >>> 7 & 31), 12);
const immediateB = (instruction: U32): I64 =>
  sx(word((instruction >>> 31) << 12 | (instruction >>> 7 & 1) << 11 | (instruction >>> 25 & 63) << 5 | (instruction >>> 8 & 15) << 1), 13);
const immediateU = (instruction: U32): I64 => sx(word(instruction & 0xfffff000), 32);
const immediateJ = (instruction: U32): I64 =>
  sx(word((instruction >>> 31) << 20 | (instruction >>> 12 & 255) << 12 | (instruction >>> 20 & 1) << 11 | (instruction >>> 21 & 1023) << 1), 21);

const compressedJump = (instruction: U32): I64 => {
  const value = instruction >>> 1 & 0x800 | instruction << 2 & 0x400 |
    instruction >>> 1 & 0x300 | instruction << 1 & 0x80 |
    instruction >>> 1 & 0x40 | instruction << 3 & 0x20 |
    instruction >>> 7 & 0x10 | instruction >>> 2 & 0xe;
  return sx(word(value), 12);
};

const loadInteger = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  address: I64,
): boolean => {
  const size = funct3 === 0 || funct3 === 4 ? 1 : funct3 === 1 || funct3 === 5 ? 2 : funct3 === 2 || funct3 === 6 ? 4 : funct3 === 3 ? 8 : 0;
  if (size === 0 || !guestAllowed(memory, hart, ux(address), size, TETO_SEGMENT_READ)) return false;
  const value = guestLoadU64(memory, hart, ux(address), size);
  if (funct3 === 0) setX(memory, hart, register, sx(value, 8));
  else if (funct3 === 1) setX(memory, hart, register, sx(value, 16));
  else if (funct3 === 2) setX(memory, hart, register, sx(value, 32));
  else if (funct3 === 3) setX(memory, hart, register, sx(value, 64));
  else setX(memory, hart, register, sx(value, 64));
  return true;
};

const storeInteger = (
  memory: TetoMemory,
  hart: U32,
  funct3: U32,
  address: I64,
  value: I64,
): boolean => {
  const size = funct3 === 0 ? 1 : funct3 === 1 ? 2 : funct3 === 2 ? 4 : funct3 === 3 ? 8 : 0;
  return size !== 0 && guestAllowed(memory, hart, ux(address), size, TETO_SEGMENT_WRITE) &&
    guestStoreU64(memory, hart, ux(address), ux(value), size);
};

const loadFloating = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  address: I64,
): boolean => {
  const size = funct3 === 2 ? 4 : funct3 === 3 ? 8 : 0;
  if (size === 0 || !guestAllowed(memory, hart, ux(address), size, TETO_SEGMENT_READ)) return false;
  const value = guestLoadU64(memory, hart, ux(address), size);
  if (funct3 === 2) setF(memory, hart, register, 0xffffffff00000000n | u32word(value));
  else setF(memory, hart, register, value);
  return true;
};

const storeFloating = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  address: I64,
): boolean => {
  const size = funct3 === 2 ? 4 : funct3 === 3 ? 8 : 0;
  return size !== 0 && guestAllowed(memory, hart, ux(address), size, TETO_SEGMENT_WRITE) &&
    guestStoreU64(memory, hart, ux(address), f(memory, hart, register), size);
};

const floatingRaw = (memory: TetoMemory, hart: U32, register: U32, single: boolean): U64 => {
  const value = f(memory, hart, register);
  if (!single) return value;
  return value >> 32n === 0xffffffffn ? value & 0xffffffffn : 0x7fc00000n;
};

const floatingValue = (memory: TetoMemory, hart: U32, register: U32, single: boolean): F64 => {
  const raw = floatingRaw(memory, hart, register, single);
  return single ? bitsToF32(raw) : bitsToF64(raw);
};

const putFloatingBits = (memory: TetoMemory, hart: U32, register: U32, value: U64, single: boolean): void => {
  setF(memory, hart, register, single ? 0xffffffff00000000n | u32word(value) : ux(value));
};

const putFloating = (memory: TetoMemory, hart: U32, register: U32, value: F64, single: boolean): void => {
  putFloatingBits(memory, hart, register, single ? f32ToBits(roundF32(value)) : f64ToBits(value), single);
};

const floatingRoundMode = (memory: TetoMemory, hart: U32, encoded: U32): I32 => {
  const mode = encoded === 7 ? loadU32(memory, hartAt(hart) + H_FCSR) >>> 5 & 7 : encoded;
  return mode > 4 ? -1 : mode;
};

const setFloatingFlags = (memory: TetoMemory, hart: U32, flags: U32): void => {
  const at = hartAt(hart) + H_FCSR;
  storeU32(memory, at, loadU32(memory, at) | flags & 31);
};

const floatingClass = (memory: TetoMemory, hart: U32, register: U32, single: boolean): I64 => {
  const raw = floatingRaw(memory, hart, register, single);
  const exponentBits = single ? 8n : 11n;
  const fractionBits = single ? 23n : 52n;
  const sign = raw >> (exponentBits + fractionBits) & 1n;
  const exponent = raw >> fractionBits & ((1n << exponentBits) - 1n);
  const fraction = raw & ((1n << fractionBits) - 1n);
  const all = (1n << exponentBits) - 1n;
  if (exponent === all) {
    if (fraction === 0n) return 1n << (sign !== 0n ? 0n : 7n);
    return 1n << ((fraction & (1n << (fractionBits - 1n))) !== 0n ? 9n : 8n);
  }
  if (exponent === 0n) {
    if (fraction === 0n) return 1n << (sign !== 0n ? 3n : 4n);
    return 1n << (sign !== 0n ? 2n : 5n);
  }
  return 1n << (sign !== 0n ? 1n : 6n);
};

const floatingToInteger = (
  memory: TetoMemory,
  hart: U32,
  value: F64,
  bits: I32,
  unsigned: boolean,
  mode: I32,
): I64 => {
  let rounded: F64;
  if (mode === 1) rounded = floatTrunc(value);
  else if (mode === 2) rounded = floatFloor(value);
  else if (mode === 3) rounded = floatCeil(value);
  else {
    const lower = floatFloor(value);
    const fraction = value - lower;
    rounded = fraction < 0.5 ? lower : fraction > 0.5 ? lower + 1 : mode === 4 ? value < 0 ? lower : lower + 1 : floatTrunc(lower / 2) * 2 === lower ? lower : lower + 1;
  }
  if (floatIsNaN(rounded)) {
    setFloatingFlags(memory, hart, 16);
    return unsigned ? bits === 32 ? sx(0xffffffffn, 64) : -1n : bits === 32 ? 0x7fffffffn : 0x7fffffffffffffffn;
  }
  const minimum: F64 = unsigned ? 0 : bits === 32 ? -2147483648 : -9223372036854775808;
  const maximum: F64 = unsigned ? bits === 32 ? 4294967295 : 18446744073709551615 : bits === 32 ? 2147483647 : 9223372036854775807;
  if (rounded <= minimum) {
    if (rounded < minimum) setFloatingFlags(memory, hart, 16);
    return unsigned ? 0n : bits === 32 ? -2147483648n : -0x8000000000000000n;
  }
  if (rounded >= maximum) {
    if (rounded > maximum) setFloatingFlags(memory, hart, 16);
    return unsigned ? bits === 32 ? sx(0xffffffffn, 64) : -1n : bits === 32 ? 0x7fffffffn : 0x7fffffffffffffffn;
  }
  return unsigned ? sx(floatToU64(rounded), 64) : floatToI64(rounded);
};

const floatingMultiplyAdd = (
  memory: TetoMemory,
  hart: U32,
  opcode: U32,
  destination: U32,
  instruction: U32,
  sourceA: U32,
  sourceB: U32,
): boolean => {
  const sourceC = instruction >>> 27 & 31;
  const format = instruction >>> 25 & 3;
  const single = format === 0;
  if (!single && format !== 1) return false;
  if (floatingRoundMode(memory, hart, instruction >>> 12 & 7) < 0) return false;
  const left = floatingValue(memory, hart, sourceA, single);
  const right = floatingValue(memory, hart, sourceB, single);
  const addend = floatingValue(memory, hart, sourceC, single);
  const result = opcode === 0x43 ? left * right + addend : opcode === 0x47 ? left * right - addend : opcode === 0x4b ? -left * right + addend : -left * right - addend;
  putFloating(memory, hart, destination, result, single);
  return true;
};

const floatingOperation = (
  memory: TetoMemory,
  hart: U32,
  destination: U32,
  funct3: U32,
  top: U32,
  sourceA: U32,
  sourceB: U32,
  instruction: U32,
): boolean => {
  const single = (top & 1) === 0;
  const left = floatingValue(memory, hart, sourceA, single);
  const right = floatingValue(memory, hart, sourceB, single);
  if (top === 0x00 || top === 0x01) {
    if (floatingRoundMode(memory, hart, funct3) < 0) return false;
    putFloating(memory, hart, destination, left + right, single);
    return true;
  }
  if (top === 0x04 || top === 0x05) {
    if (floatingRoundMode(memory, hart, funct3) < 0) return false;
    putFloating(memory, hart, destination, left - right, single);
    return true;
  }
  if (top === 0x08 || top === 0x09) {
    if (floatingRoundMode(memory, hart, funct3) < 0) return false;
    putFloating(memory, hart, destination, left * right, single);
    return true;
  }
  if (top === 0x0c || top === 0x0d) {
    if (floatingRoundMode(memory, hart, funct3) < 0) return false;
    if (right === 0 && left !== 0) setFloatingFlags(memory, hart, 8);
    else if (right === 0 && left === 0) setFloatingFlags(memory, hart, 16);
    putFloating(memory, hart, destination, left / right, single);
    return true;
  }
  if (top === 0x10 || top === 0x11) {
    if (funct3 > 2) return false;
    const sign = single ? 0x80000000n : 0x8000000000000000n;
    const magnitude = floatingRaw(memory, hart, sourceA, single) & ~sign;
    const signA = floatingRaw(memory, hart, sourceA, single) & sign;
    const signB = floatingRaw(memory, hart, sourceB, single) & sign;
    putFloatingBits(memory, hart, destination, magnitude | (funct3 === 0 ? signB : funct3 === 1 ? signB ^ sign : signA ^ signB), single);
    return true;
  }
  if (top === 0x14 || top === 0x15) {
    if (funct3 > 1) return false;
    if (floatIsNaN(left) && floatIsNaN(right)) putFloatingBits(memory, hart, destination, single ? 0x7fc00000n : 0x7ff8000000000000n, single);
    else if (floatIsNaN(left)) putFloatingBits(memory, hart, destination, floatingRaw(memory, hart, sourceB, single), single);
    else if (floatIsNaN(right)) putFloatingBits(memory, hart, destination, floatingRaw(memory, hart, sourceA, single), single);
    else putFloating(memory, hart, destination, funct3 === 1 ? floatMax(left, right) : floatMin(left, right), single);
    return true;
  }
  if (top === 0x20) {
    if (sourceB !== 1 || floatingRoundMode(memory, hart, funct3) < 0) return false;
    putFloating(memory, hart, destination, floatingValue(memory, hart, sourceA, false), true);
    return true;
  }
  if (top === 0x21) {
    if (sourceB !== 0 || floatingRoundMode(memory, hart, funct3) < 0) return false;
    putFloating(memory, hart, destination, floatingValue(memory, hart, sourceA, true), false);
    return true;
  }
  if (top === 0x2c || top === 0x2d) {
    if (sourceB !== 0 || floatingRoundMode(memory, hart, funct3) < 0) return false;
    putFloating(memory, hart, destination, floatSqrt(left), single);
    return true;
  }
  if (top === 0x50 || top === 0x51) {
    if (funct3 > 2) return false;
    if (floatIsNaN(left) || floatIsNaN(right)) {
      if (funct3 !== 2) setFloatingFlags(memory, hart, 16);
      setX(memory, hart, destination, 0n);
    } else setX(memory, hart, destination, funct3 === 0 ? left <= right ? 1n : 0n : funct3 === 1 ? left < right ? 1n : 0n : left === right ? 1n : 0n);
    return true;
  }
  if (top === 0x60 || top === 0x61) {
    if (sourceB > 3) return false;
    const bits = sourceB < 2 ? 32 : 64;
    const unsigned = (sourceB & 1) !== 0;
    const mode = floatingRoundMode(memory, hart, funct3);
    if (mode < 0) return false;
    const result = floatingToInteger(memory, hart, left, bits, unsigned, mode);
    setX(memory, hart, destination, bits === 32 ? sx(result, 32) : result);
    return true;
  }
  if (top === 0x68 || top === 0x69) {
    if (sourceB > 3 || floatingRoundMode(memory, hart, funct3) < 0) return false;
    const source = x(memory, hart, sourceA);
    const value = sourceB === 0 ? wordToFloat(sx(source, 32)) : sourceB === 1 ? unsignedWordToFloat(u32word(source)) : sourceB === 2 ? wordToFloat(source) : unsignedWordToFloat(ux(source));
    putFloating(memory, hart, destination, value, single);
    return true;
  }
  if (top === 0x70 || top === 0x71) {
    if (sourceB !== 0) return false;
    if (funct3 === 0) setX(memory, hart, destination, single ? sx(floatingRaw(memory, hart, sourceA, true), 32) : sx(floatingRaw(memory, hart, sourceA, false), 64));
    else if (funct3 === 1) setX(memory, hart, destination, floatingClass(memory, hart, sourceA, single));
    else return false;
    return true;
  }
  if (top === 0x78 || top === 0x79) {
    if (sourceB !== 0 || funct3 !== 0) return false;
    putFloatingBits(memory, hart, destination, single ? u32word(x(memory, hart, sourceA)) : ux(x(memory, hart, sourceA)), single);
    return true;
  }
  return false;
};

const branch = (funct3: U32, left: I64, right: I64): I32 => {
  if (funct3 === 0) return left === right ? 1 : 0;
  if (funct3 === 1) return left !== right ? 1 : 0;
  if (funct3 === 4) return left < right ? 1 : 0;
  if (funct3 === 5) return left >= right ? 1 : 0;
  if (funct3 === 6) return ux(left) < ux(right) ? 1 : 0;
  if (funct3 === 7) return ux(left) >= ux(right) ? 1 : 0;
  return -1;
};

const opImmediate = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  instruction: U32,
  left: I64,
): boolean => {
  const immediate = immediateI(instruction);
  const shift = instruction >>> 20 & 63;
  if (funct3 === 0) setX(memory, hart, register, left + immediate);
  else if (funct3 === 1 && instruction >>> 26 === 0) setX(memory, hart, register, ux(left) << word(shift));
  else if (funct3 === 2) setX(memory, hart, register, left < immediate ? 1n : 0n);
  else if (funct3 === 3) setX(memory, hart, register, ux(left) < ux(immediate) ? 1n : 0n);
  else if (funct3 === 4) setX(memory, hart, register, left ^ immediate);
  else if (funct3 === 5 && instruction >>> 26 === 0) setX(memory, hart, register, ux(left) >> word(shift));
  else if (funct3 === 5 && instruction >>> 26 === 0x10) setX(memory, hart, register, left >> word(shift));
  else if (funct3 === 6) setX(memory, hart, register, left | immediate);
  else if (funct3 === 7) setX(memory, hart, register, left & immediate);
  else return false;
  return true;
};

const opImmediateWord = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  instruction: U32,
  left: I64,
): boolean => {
  const shift = instruction >>> 20 & 31;
  if (funct3 === 0) setX(memory, hart, register, sx(left + immediateI(instruction), 32));
  else if (funct3 === 1 && instruction >>> 25 === 0) setX(memory, hart, register, sx(sx(left, 32) << word(shift), 32));
  else if (funct3 === 5 && instruction >>> 25 === 0) setX(memory, hart, register, sx(u32word(left) >> word(shift), 32));
  else if (funct3 === 5 && instruction >>> 25 === 0x20) setX(memory, hart, register, sx(sx(left, 32) >> word(shift), 32));
  else return false;
  return true;
};

const opRegister = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  top: U32,
  left: I64,
  right: I64,
): boolean => {
  const shift = wordToU32(ux(right) & 63n);
  if (top === 1) {
    if (funct3 === 0) setX(memory, hart, register, left * right);
    else if (funct3 === 1) setX(memory, hart, register, mulHighSigned(left, right));
    else if (funct3 === 2) setX(memory, hart, register, mulHighSignedUnsigned(left, ux(right)));
    else if (funct3 === 3) setX(memory, hart, register, mulHighUnsigned(ux(left), ux(right)));
    else if (funct3 === 4) setX(memory, hart, register, divSigned(left, right, 64));
    else if (funct3 === 5) setX(memory, hart, register, divUnsigned(ux(left), ux(right), 64));
    else if (funct3 === 6) setX(memory, hart, register, remSigned(left, right, 64));
    else if (funct3 === 7) setX(memory, hart, register, remUnsigned(ux(left), ux(right), 64));
    else return false;
    return true;
  }
  if (funct3 === 0 && top === 0) setX(memory, hart, register, left + right);
  else if (funct3 === 0 && top === 0x20) setX(memory, hart, register, left - right);
  else if (funct3 === 1 && top === 0) setX(memory, hart, register, ux(left) << word(shift));
  else if (funct3 === 2 && top === 0) setX(memory, hart, register, left < right ? 1n : 0n);
  else if (funct3 === 3 && top === 0) setX(memory, hart, register, ux(left) < ux(right) ? 1n : 0n);
  else if (funct3 === 4 && top === 0) setX(memory, hart, register, left ^ right);
  else if (funct3 === 5 && top === 0) setX(memory, hart, register, ux(left) >> word(shift));
  else if (funct3 === 5 && top === 0x20) setX(memory, hart, register, left >> word(shift));
  else if (funct3 === 6 && top === 0) setX(memory, hart, register, left | right);
  else if (funct3 === 7 && top === 0) setX(memory, hart, register, left & right);
  else return false;
  return true;
};

const opRegisterWord = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  top: U32,
  left: I64,
  right: I64,
): boolean => {
  const shift = wordToU32(ux(right) & 31n);
  if (top === 1) {
    if (funct3 === 0) setX(memory, hart, register, sx(sx(left, 32) * sx(right, 32), 32));
    else if (funct3 === 4) setX(memory, hart, register, sx(divSigned(left, right, 32), 32));
    else if (funct3 === 5) setX(memory, hart, register, sx(divUnsigned(u32word(left), u32word(right), 32), 32));
    else if (funct3 === 6) setX(memory, hart, register, sx(remSigned(left, right, 32), 32));
    else if (funct3 === 7) setX(memory, hart, register, sx(remUnsigned(u32word(left), u32word(right), 32), 32));
    else return false;
    return true;
  }
  if (funct3 === 0 && top === 0) setX(memory, hart, register, sx(left + right, 32));
  else if (funct3 === 0 && top === 0x20) setX(memory, hart, register, sx(left - right, 32));
  else if (funct3 === 1 && top === 0) setX(memory, hart, register, sx(sx(left, 32) << word(shift), 32));
  else if (funct3 === 5 && top === 0) setX(memory, hart, register, sx(u32word(left) >> word(shift), 32));
  else if (funct3 === 5 && top === 0x20) setX(memory, hart, register, sx(sx(left, 32) >> word(shift), 32));
  else return false;
  return true;
};

const csr = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  instruction: U32,
  left: I64,
  source: U32,
  nowMicros: I64,
): boolean => {
  const id = instruction >>> 20;
  const writable = id >= 1 && id <= 3;
  let old: I64;
  if (id === 0xc00 || id === 0xc02) old = 0n;
  else if (id === 0xc01) old = nowMicros;
  else if (id === 1) old = word(loadU32(memory, hartAt(hart) + H_FCSR) & 31);
  else if (id === 2) old = word(loadU32(memory, hartAt(hart) + H_FCSR) >>> 5 & 7);
  else if (id === 3) old = word(loadU32(memory, hartAt(hart) + H_FCSR) & 255);
  else return false;
  if (funct3 !== 1 && funct3 !== 2 && funct3 !== 3 && funct3 !== 5 && funct3 !== 6 && funct3 !== 7) return false;
  const value = funct3 >= 5 ? word(source) : sx(left, 64);
  const write = funct3 === 1 || funct3 === 5 ? value : funct3 === 2 || funct3 === 6 ? old | value : old & ~value;
  const hit = funct3 === 1 || funct3 === 5 || value !== 0n;
  if (hit && !writable) return false;
  if (hit) {
    const current = loadU32(memory, hartAt(hart) + H_FCSR);
    if (id === 1) storeU32(memory, hartAt(hart) + H_FCSR, current & ~31 | wordToU32(write & 31n));
    else if (id === 2) storeU32(memory, hartAt(hart) + H_FCSR, current & 31 | wordToU32(write & 7n) << 5);
    else storeU32(memory, hartAt(hart) + H_FCSR, wordToU32(write & 255n));
  }
  setX(memory, hart, register, old);
  return true;
};

const atomicInstruction = (
  memory: TetoMemory,
  hart: U32,
  register: U32,
  funct3: U32,
  instruction: U32,
  address: I64,
  value: I64,
): I32 => {
  if (funct3 !== 2 && funct3 !== 3) return TETO_BATCH_FAULT;
  const size = funct3 === 2 ? 4 : 8;
  const fn = instruction >>> 27;
  const permission = fn === 2 ? TETO_SEGMENT_READ : TETO_SEGMENT_READ | TETO_SEGMENT_WRITE;
  if (!guestAllowed(memory, hart, ux(address), size, permission)) return TETO_BATCH_FAULT;
  const pointer = guestPointer(memory, hart, ux(address), size, true);
  if (pointer === INVALID_POINTER || pointer === UNMAPPED_POINTER) return TETO_BATCH_FAULT;
  const lockAt = TETO_CONTROL_BASE + C_ATOMIC_LOCK;
  if (!acquire(memory, lockAt)) return TETO_BATCH_CONTENDED;
  const at = hartAt(hart);
  const old = funct3 === 2 ? word(loadI32(memory, pointer)) : loadI64(memory, pointer);
  if (fn === 2) {
    if ((instruction >>> 20 & 31) !== 0) {
      release(memory, lockAt);
      return TETO_BATCH_FAULT;
    }
    storeI64(memory, at + H_RESERVATION, address);
    setX(memory, hart, register, old);
    release(memory, lockAt);
    return TETO_BATCH_BUDGET;
  }
  if (fn === 3) {
    const success = loadI64(memory, at + H_RESERVATION) === address;
    storeI64(memory, at + H_RESERVATION, NO_RESERVATION);
    if (success) {
      if (funct3 === 2) storeU32(memory, pointer, value);
      else storeI64(memory, pointer, value);
    }
    setX(memory, hart, register, success ? 0n : 1n);
    release(memory, lockAt);
    return TETO_BATCH_BUDGET;
  }
  const left = funct3 === 2 ? sx(old, 32) : old;
  const right = funct3 === 2 ? sx(value, 32) : value;
  const leftUnsigned = funct3 === 2 ? u32word(old) : ux(old);
  const rightUnsigned = funct3 === 2 ? u32word(value) : ux(value);
  let output: I64;
  if (fn === 0) output = left + right;
  else if (fn === 1) output = right;
  else if (fn === 4) output = left ^ right;
  else if (fn === 8) output = left | right;
  else if (fn === 12) output = left & right;
  else if (fn === 16) output = left < right ? left : right;
  else if (fn === 20) output = left > right ? left : right;
  else if (fn === 24) output = sx(leftUnsigned < rightUnsigned ? leftUnsigned : rightUnsigned, 64);
  else if (fn === 28) output = sx(leftUnsigned > rightUnsigned ? leftUnsigned : rightUnsigned, 64);
  else {
    release(memory, lockAt);
    return TETO_BATCH_FAULT;
  }
  if (funct3 === 2) storeU32(memory, pointer, output);
  else storeI64(memory, pointer, output);
  storeI64(memory, at + H_RESERVATION, NO_RESERVATION);
  setX(memory, hart, register, old);
  release(memory, lockAt);
  return TETO_BATCH_BUDGET;
};

const procId = (memory: TetoMemory, proc: Ptr, field: U32): U64 =>
  ux(word(wordToU32(word(atomicLoadI32(memory, proc + field)))));

const keepId = (value: I64): boolean => ux(value) === 0xffffffffn || ux(value) === 0xffffffffffffffffn;
const validId = (value: I64): boolean => value >= 0n && ux(value) < 0xffffffffn;

const canSetUid = (memory: TetoMemory, proc: Ptr, value: U64): boolean =>
  procId(memory, proc, P_EUID) === 0n || value === procId(memory, proc, P_RUID) ||
  value === procId(memory, proc, P_EUID) || value === procId(memory, proc, P_SUID);

const canSetGid = (memory: TetoMemory, proc: Ptr, value: U64): boolean =>
  procId(memory, proc, P_EUID) === 0n || value === procId(memory, proc, P_RGID) ||
  value === procId(memory, proc, P_EGID) || value === procId(memory, proc, P_SGID);

const storeProcId = (memory: TetoMemory, proc: Ptr, field: U32, value: U64): void =>
  atomicStoreI32(memory, proc + field, wordToI32(value));

const setResUid = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const r = x(memory, hart, 10), e = x(memory, hart, 11), s = x(memory, hart, 12);
  if ((!keepId(r) && (!validId(r) || !canSetUid(memory, proc, ux(r)))) ||
      (!keepId(e) && (!validId(e) || !canSetUid(memory, proc, ux(e)))) ||
      (!keepId(s) && (!validId(s) || !canSetUid(memory, proc, ux(s))))) return -1n;
  const nextR = keepId(r) ? procId(memory, proc, P_RUID) : ux(r);
  const nextE = keepId(e) ? procId(memory, proc, P_EUID) : ux(e);
  const nextS = keepId(s) ? procId(memory, proc, P_SUID) : ux(s);
  storeProcId(memory, proc, P_RUID, nextR);
  storeProcId(memory, proc, P_EUID, nextE);
  storeProcId(memory, proc, P_SUID, nextS);
  storeProcId(memory, proc, P_FSUID, nextE);
  return 0n;
};

const setResGid = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const r = x(memory, hart, 10), e = x(memory, hart, 11), s = x(memory, hart, 12);
  if ((!keepId(r) && (!validId(r) || !canSetGid(memory, proc, ux(r)))) ||
      (!keepId(e) && (!validId(e) || !canSetGid(memory, proc, ux(e)))) ||
      (!keepId(s) && (!validId(s) || !canSetGid(memory, proc, ux(s))))) return -1n;
  const nextR = keepId(r) ? procId(memory, proc, P_RGID) : ux(r);
  const nextE = keepId(e) ? procId(memory, proc, P_EGID) : ux(e);
  const nextS = keepId(s) ? procId(memory, proc, P_SGID) : ux(s);
  storeProcId(memory, proc, P_RGID, nextR);
  storeProcId(memory, proc, P_EGID, nextE);
  storeProcId(memory, proc, P_SGID, nextS);
  storeProcId(memory, proc, P_FSGID, nextE);
  return 0n;
};

const setReUid = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const r = x(memory, hart, 10), e = x(memory, hart, 11);
  const oldR = procId(memory, proc, P_RUID);
  if ((!keepId(r) && (!validId(r) || !canSetUid(memory, proc, ux(r)))) ||
      (!keepId(e) && (!validId(e) || !canSetUid(memory, proc, ux(e))))) return -1n;
  const nextR = keepId(r) ? oldR : ux(r);
  const nextE = keepId(e) ? procId(memory, proc, P_EUID) : ux(e);
  const nextS = !keepId(r) || (!keepId(e) && ux(e) !== oldR) ? nextE : procId(memory, proc, P_SUID);
  storeProcId(memory, proc, P_RUID, nextR);
  storeProcId(memory, proc, P_EUID, nextE);
  storeProcId(memory, proc, P_SUID, nextS);
  storeProcId(memory, proc, P_FSUID, nextE);
  return 0n;
};

const setReGid = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const r = x(memory, hart, 10), e = x(memory, hart, 11);
  const oldR = procId(memory, proc, P_RGID);
  if ((!keepId(r) && (!validId(r) || !canSetGid(memory, proc, ux(r)))) ||
      (!keepId(e) && (!validId(e) || !canSetGid(memory, proc, ux(e))))) return -1n;
  const nextR = keepId(r) ? oldR : ux(r);
  const nextE = keepId(e) ? procId(memory, proc, P_EGID) : ux(e);
  const nextS = !keepId(r) || (!keepId(e) && ux(e) !== oldR) ? nextE : procId(memory, proc, P_SGID);
  storeProcId(memory, proc, P_RGID, nextR);
  storeProcId(memory, proc, P_EGID, nextE);
  storeProcId(memory, proc, P_SGID, nextS);
  storeProcId(memory, proc, P_FSGID, nextE);
  return 0n;
};

const setUid = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const value = x(memory, hart, 10);
  if (!validId(value)) return -22n;
  const id = ux(value);
  if (!canSetUid(memory, proc, id)) return -1n;
  if (procId(memory, proc, P_EUID) === 0n) {
    storeProcId(memory, proc, P_RUID, id);
    storeProcId(memory, proc, P_SUID, id);
  }
  storeProcId(memory, proc, P_EUID, id);
  storeProcId(memory, proc, P_FSUID, id);
  return 0n;
};

const setGid = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const value = x(memory, hart, 10);
  if (!validId(value)) return -22n;
  const id = ux(value);
  if (!canSetGid(memory, proc, id)) return -1n;
  if (procId(memory, proc, P_EUID) === 0n) {
    storeProcId(memory, proc, P_RGID, id);
    storeProcId(memory, proc, P_SGID, id);
  }
  storeProcId(memory, proc, P_EGID, id);
  storeProcId(memory, proc, P_FSGID, id);
  return 0n;
};

const getResId = (memory: TetoMemory, hart: U32, proc: Ptr, group: boolean): I64 => {
  const a = ux(x(memory, hart, 10)), b = ux(x(memory, hart, 11)), c = ux(x(memory, hart, 12));
  if (a === 0n || b === 0n || c === 0n ||
      !guestAllowed(memory, hart, a, 4, TETO_SEGMENT_WRITE) ||
      !guestAllowed(memory, hart, b, 4, TETO_SEGMENT_WRITE) ||
      !guestAllowed(memory, hart, c, 4, TETO_SEGMENT_WRITE) ||
      !guestWritable(memory, hart, a, 4) || !guestWritable(memory, hart, b, 4) ||
      !guestWritable(memory, hart, c, 4)) return -14n;
  const first = procId(memory, proc, group ? P_RGID : P_RUID);
  const second = procId(memory, proc, group ? P_EGID : P_EUID);
  const third = procId(memory, proc, group ? P_SGID : P_SUID);
  if (!guestStoreU64(memory, hart, a, first, 4) || !guestStoreU64(memory, hart, b, second, 4) ||
      !guestStoreU64(memory, hart, c, third, 4)) return -12n;
  return 0n;
};

const getGroups = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  const wideCount = ux(x(memory, hart, 10));
  if (wideCount > 65536n) return -22n;
  const count = wordToU32(word(atomicLoadI32(memory, proc + P_GROUP_COUNT)));
  if (wideCount === 0n) return word(count);
  if (wideCount < ux(word(count))) return -22n;
  const address = ux(x(memory, hart, 11));
  if (address === 0n || !guestAllowed(memory, hart, address, count * 4, TETO_SEGMENT_WRITE) ||
      !guestWritable(memory, hart, address, count * 4)) return -14n;
  let index: U32 = 0;
  while (index < count) {
    const gid = procId(memory, proc, P_GROUPS + index * 4);
    if (!guestStoreU64(memory, hart, address + ux(word(index * 4)), gid, 4)) return -12n;
    index += 1;
  }
  return word(count);
};

const setGroups = (memory: TetoMemory, hart: U32, proc: Ptr): I64 => {
  if (procId(memory, proc, P_EUID) !== 0n) return -1n;
  const wideCount = ux(x(memory, hart, 10));
  if (wideCount > ux(word(TETO_GROUP_CAPACITY))) return -22n;
  const count = wordToU32(wideCount);
  const address = ux(x(memory, hart, 11));
  if (count !== 0 && (address === 0n || !guestAllowed(memory, hart, address, count * 4, TETO_SEGMENT_READ))) return -14n;
  let index: U32 = 0;
  while (index < count) {
    const value = guestLoadU64(memory, hart, address + ux(word(index * 4)), 4);
    if (value >= 0xffffffffn) return -22n;
    index += 1;
  }
  index = 0;
  while (index < count) {
    storeProcId(memory, proc, P_GROUPS + index * 4, guestLoadU64(memory, hart, address + ux(word(index * 4)), 4));
    index += 1;
  }
  atomicStoreI32(memory, proc + P_GROUP_COUNT, wordToI32(word(count)));
  return 0n;
};

const credentialSyscall = (memory: TetoMemory, hart: U32, proc: Ptr, number: U32): I64 => {
  if (number === 143) return setReGid(memory, hart, proc);
  if (number === 144) return setGid(memory, hart, proc);
  if (number === 145) return setReUid(memory, hart, proc);
  if (number === 146) return setUid(memory, hart, proc);
  if (number === 147) return setResUid(memory, hart, proc);
  if (number === 148) return getResId(memory, hart, proc, false);
  if (number === 149) return setResGid(memory, hart, proc);
  if (number === 150) return getResId(memory, hart, proc, true);
  if (number === 151 || number === 152) {
    const field = number === 151 ? P_FSUID : P_FSGID;
    const old = procId(memory, proc, field);
    const value = x(memory, hart, 10);
    if (!validId(value)) return -22n;
    if (number === 151 ? canSetUid(memory, proc, ux(value)) : canSetGid(memory, proc, ux(value))) {
      storeProcId(memory, proc, field, ux(value));
    }
    return old;
  }
  if (number === 158) return getGroups(memory, hart, proc);
  if (number === 159) return setGroups(memory, hart, proc);
  return -38n;
};

const internalSyscall = (memory: TetoMemory, hart: U32, result: I64): I32 => {
  setX(memory, hart, 10, result);
  bump(memory, hartAt(hart) + H_INTERNAL_SYSCALLS);
  return TETO_BATCH_BUDGET;
};

const programBreak = (memory: TetoMemory, hart: U32, proc: Ptr): I32 => {
  const lock = proc + P_LOCK;
  if (!acquire(memory, lock)) {
    setPc(memory, hart, loadU64(memory, hartAt(hart) + H_PC) - 4n);
    return TETO_BATCH_CONTENDED;
  }
  const current = atomicLoadU64(memory, proc + P_BRK);
  const requested = ux(x(memory, hart, 10));
  if (requested === 0n) {
    release(memory, lock);
    return internalSyscall(memory, hart, sx(current, 64));
  }
  const base = atomicLoadU64(memory, proc + P_BRK_BASE);
  const stack = atomicLoadU64(memory, proc + P_STACK_BOTTOM);
  let collision = false;
  const mapCount = loadU32(memory, proc + P_MAP_COUNT);
  let mapIndex: U32 = 0;
  while (mapIndex < mapCount) {
    const mapping = mapAt(memory, proc, mapIndex);
    const start = loadU64(memory, mapping + M_ADDRESS);
    if (start <= MAP_GUARD || requested >= start - MAP_GUARD) collision = true;
    mapIndex += 1;
  }
  if (requested < base || stack === 0n || requested >= stack || stack - requested <= MAP_GUARD || collision) {
    release(memory, lock);
    return internalSyscall(memory, hart, sx(current, 64));
  }
  if (requested < current) clearMappedRange(memory, proc, requested, current);
  atomicStoreU64(memory, proc + P_BRK, requested);
  release(memory, lock);
  return internalSyscall(memory, hart, sx(requested, 64));
};

const fallbackSyscall = (memory: TetoMemory, hart: U32): I32 => {
  const at = hartAt(hart);
  const proc = processForHart(memory, hart);
  bump(memory, at + H_FALLBACK_SYSCALLS);
  if (proc !== INVALID_POINTER) atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_WAITING);
  storeI32(memory, at + H_EVENT, TETO_EVENT_SYSCALL);
  atomicStoreI32(memory, at + H_STATUS, TETO_HART_WAITING);
  return TETO_BATCH_SYSCALL;
};

const kernelSyscall = (memory: TetoMemory, hart: U32): I32 => {
  const at = hartAt(hart);
  const proc = processForHart(memory, hart);
  const number = wordToU32(ux(x(memory, hart, 17)));
  bump(memory, at + H_KERNEL_SYSCALLS);
  if (number === 93 || number === 94) {
    const code = wordToI32(x(memory, hart, 10));
    storeI32(memory, at + H_EXIT_CODE, code);
    if (proc !== INVALID_POINTER) {
      atomicStoreI32(memory, proc + P_EXIT_CODE, code);
      atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_ZOMBIE);
    }
    setX(memory, hart, 10, word(code));
    bump(memory, at + H_INTERNAL_SYSCALLS);
    storeI32(memory, at + H_EVENT, TETO_EVENT_NONE);
    atomicStoreI32(memory, at + H_STATUS, TETO_HART_EXITED);
    return TETO_BATCH_EXITED;
  }
  if (number === 64) {
    const descriptor = wordToI32(x(memory, hart, 10));
    const address = ux(x(memory, hart, 11));
    const wideLength = ux(x(memory, hart, 12));
    if (descriptor !== 1 && descriptor !== 2) return fallbackSyscall(memory, hart);
    if (wideLength > 1048576n) return internalSyscall(memory, hart, -22n);
    const length = wordToU32(wideLength);
    if (!guestAllowed(memory, hart, address, length, TETO_SEGMENT_READ)) return internalSyscall(memory, hart, -14n);
    if (length === 0) return internalSyscall(memory, hart, 0n);
    storeI32(memory, at + H_HOST_OPERATION, TETO_HOST_WRITE);
    storeI32(memory, at + H_HOST_DESCRIPTOR, descriptor);
    storeU64(memory, at + H_HOST_ADDRESS, address);
    storeU32(memory, at + H_HOST_LENGTH, length);
    bump(memory, at + H_HOST_REQUESTS);
    storeI32(memory, at + H_EVENT, TETO_EVENT_HOST);
    atomicStoreI32(memory, at + H_STATUS, TETO_HART_WAITING);
    if (proc !== INVALID_POINTER) atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_WAITING);
    return TETO_BATCH_HOST;
  }
  if (number === 124) return internalSyscall(memory, hart, 0n);
  if (number === 214) {
    if (proc === INVALID_POINTER) return internalSyscall(memory, hart, -3n);
    return programBreak(memory, hart, proc);
  }
  if (number === 222 && (ux(x(memory, hart, 13)) & 0x20n) !== 0n) {
    if (proc === INVALID_POINTER) return internalSyscall(memory, hart, -3n);
    const lock = proc + P_LOCK;
    if (!acquire(memory, lock)) {
      setPc(memory, hart, loadU64(memory, at + H_PC) - 4n);
      return TETO_BATCH_CONTENDED;
    }
    const result = anonymousMap(memory, proc, ux(x(memory, hart, 10)), ux(x(memory, hart, 11)),
      ux(x(memory, hart, 12)), ux(x(memory, hart, 13)));
    release(memory, lock);
    return internalSyscall(memory, hart, result);
  }
  if (number === 215) {
    if (proc === INVALID_POINTER) return internalSyscall(memory, hart, -3n);
    const lock = proc + P_LOCK;
    if (!acquire(memory, lock)) {
      setPc(memory, hart, loadU64(memory, at + H_PC) - 4n);
      return TETO_BATCH_CONTENDED;
    }
    const result = anonymousUnmap(memory, proc, ux(x(memory, hart, 10)), ux(x(memory, hart, 11)));
    release(memory, lock);
    if (result === MAP_NOT_OWNED) return fallbackSyscall(memory, hart);
    return internalSyscall(memory, hart, result);
  }
  if (number === 216 || number === 226 || number === 227) {
    if (proc === INVALID_POINTER) return internalSyscall(memory, hart, -3n);
    const lock = proc + P_LOCK;
    if (!acquire(memory, lock)) {
      setPc(memory, hart, loadU64(memory, at + H_PC) - 4n);
      return TETO_BATCH_CONTENDED;
    }
    let result: I64 = MAP_NOT_OWNED;
    if (number === 216) {
      result = remapAnonymous(memory, hart, proc, ux(x(memory, hart, 10)), ux(x(memory, hart, 11)),
        ux(x(memory, hart, 12)), ux(x(memory, hart, 13)), ux(x(memory, hart, 14)));
    } else if (number === 226) {
      result = protectMappings(memory, proc, ux(x(memory, hart, 10)), ux(x(memory, hart, 11)), ux(x(memory, hart, 12)));
    } else {
      result = syncAnonymous(memory, proc, ux(x(memory, hart, 10)), ux(x(memory, hart, 11)), ux(x(memory, hart, 12)));
    }
    release(memory, lock);
    if (result === MAP_NOT_OWNED) return fallbackSyscall(memory, hart);
    return internalSyscall(memory, hart, result);
  }
  if ((number >= 143 && number <= 152) || number === 158 || number === 159) {
    if (proc === INVALID_POINTER) return internalSyscall(memory, hart, -3n);
    const lock = TETO_CONTROL_BASE + C_CREDENTIAL_LOCK;
    if (!acquire(memory, lock)) {
      setPc(memory, hart, loadU64(memory, at + H_PC) - 4n);
      return TETO_BATCH_CONTENDED;
    }
    const result = credentialSyscall(memory, hart, proc, number);
    release(memory, lock);
    return internalSyscall(memory, hart, result);
  }
  if (number >= 172 && number <= 178) {
    if (proc === INVALID_POINTER) return internalSyscall(memory, hart, -3n);
    if (number === 172 || number === 178) return internalSyscall(memory, hart, word(atomicLoadI32(memory, proc + P_PID)));
    if (number === 173) return internalSyscall(memory, hart, word(atomicLoadI32(memory, proc + P_PPID)));
    if (number === 174) return internalSyscall(memory, hart, word(atomicLoadI32(memory, proc + P_RUID)));
    if (number === 175) return internalSyscall(memory, hart, word(atomicLoadI32(memory, proc + P_EUID)));
    if (number === 176) return internalSyscall(memory, hart, word(atomicLoadI32(memory, proc + P_RGID)));
    if (number === 177) return internalSyscall(memory, hart, word(atomicLoadI32(memory, proc + P_EGID)));
  }
  return fallbackSyscall(memory, hart);
};

const compressedStep = (
  memory: TetoMemory,
  hart: U32,
  instruction: U32,
  atPc: U64,
): I32 => {
  const quadrant = instruction & 3;
  const funct = instruction >>> 13;
  const rd = instruction >>> 7 & 31;
  const rs = instruction >>> 2 & 31;
  const primeRd = 8 + (instruction >>> 7 & 7);
  const primeRs = 8 + (instruction >>> 2 & 7);
  const immediate = sx(word((instruction >>> 7 & 0x20) | (instruction >>> 2 & 0x1f)), 6);
  if (quadrant === 0) {
    if (funct === 0) {
      const value = instruction >>> 1 & 0x3c0 | instruction >>> 7 & 0x30 | instruction >>> 2 & 8 | instruction >>> 4 & 4;
      if (value === 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
      setX(memory, hart, primeRs, x(memory, hart, 2) + word(value));
    } else if (funct === 1) {
      const offset = instruction << 1 & 0xc0 | instruction >>> 7 & 0x38;
      if (!loadFloating(memory, hart, primeRs, 3, x(memory, hart, primeRd) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 2) {
      const offset = instruction << 1 & 0x40 | instruction >>> 7 & 0x38 | instruction >>> 4 & 4;
      if (!loadInteger(memory, hart, primeRs, 2, x(memory, hart, primeRd) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 3) {
      const offset = instruction << 1 & 0xc0 | instruction >>> 7 & 0x38;
      if (!loadInteger(memory, hart, primeRs, 3, x(memory, hart, primeRd) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 5) {
      const offset = instruction << 1 & 0xc0 | instruction >>> 7 & 0x38;
      if (!storeFloating(memory, hart, primeRs, 3, x(memory, hart, primeRd) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 6) {
      const offset = instruction << 1 & 0x40 | instruction >>> 7 & 0x38 | instruction >>> 4 & 4;
      if (!storeInteger(memory, hart, 2, x(memory, hart, primeRd) + word(offset), x(memory, hart, primeRs))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 7) {
      const offset = instruction << 1 & 0xc0 | instruction >>> 7 & 0x38;
      if (!storeInteger(memory, hart, 3, x(memory, hart, primeRd) + word(offset), x(memory, hart, primeRs))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
    return TETO_BATCH_BUDGET;
  }
  if (quadrant === 1) {
    if (funct === 0) setX(memory, hart, rd, x(memory, hart, rd) + immediate);
    else if (funct === 1) {
      if (rd === 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
      setX(memory, hart, rd, sx(x(memory, hart, rd) + immediate, 32));
    } else if (funct === 2) setX(memory, hart, rd, immediate);
    else if (funct === 3) {
      if (rd === 2) {
        const value = instruction >>> 3 & 0x200 | instruction >>> 2 & 0x10 | instruction << 1 & 0x40 | instruction << 4 & 0x180 | instruction << 3 & 0x20;
        const offset = sx(word(value), 10);
        if (offset === 0n) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
        setX(memory, hart, 2, x(memory, hart, 2) + offset);
      } else {
        const value = sx(word(instruction << 5 & 0x20000 | instruction << 10 & 0x1f000), 18);
        if (rd === 0 || value === 0n) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
        setX(memory, hart, rd, value);
      }
    } else if (funct === 4) {
      const funct2 = instruction >>> 10 & 3;
      const shift = word((instruction >>> 7 & 0x20) | (instruction >>> 2 & 0x1f));
      if (funct2 === 0) setX(memory, hart, primeRd, ux(x(memory, hart, primeRd)) >> shift);
      else if (funct2 === 1) setX(memory, hart, primeRd, x(memory, hart, primeRd) >> shift);
      else if (funct2 === 2) setX(memory, hart, primeRd, x(memory, hart, primeRd) & immediate);
      else {
        const high = instruction >>> 12 & 1;
        const low = instruction >>> 5 & 3;
        const left = x(memory, hart, primeRd);
        const right = x(memory, hart, primeRs);
        if (high === 0 && low === 0) setX(memory, hart, primeRd, left - right);
        else if (high === 0 && low === 1) setX(memory, hart, primeRd, left ^ right);
        else if (high === 0 && low === 2) setX(memory, hart, primeRd, left | right);
        else if (high === 0 && low === 3) setX(memory, hart, primeRd, left & right);
        else if (high === 1 && low === 0) setX(memory, hart, primeRd, sx(left - right, 32));
        else if (high === 1 && low === 1) setX(memory, hart, primeRd, sx(left + right, 32));
        else return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
      }
    } else if (funct === 5) setPc(memory, hart, atPc + ux(compressedJump(instruction)));
    else if (funct === 6 || funct === 7) {
      const value = instruction >>> 4 & 0x100 | instruction << 1 & 0xc0 | instruction << 3 & 0x20 | instruction >>> 7 & 0x18 | instruction >>> 2 & 6;
      if (funct === 6 ? x(memory, hart, primeRd) === 0n : x(memory, hart, primeRd) !== 0n) {
        setPc(memory, hart, atPc + ux(sx(word(value), 9)));
      }
    } else return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
    return TETO_BATCH_BUDGET;
  }
  if (quadrant === 2) {
    if (funct === 0) {
      const shift = word((instruction >>> 7 & 0x20) | (instruction >>> 2 & 0x1f));
      if (rd === 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
      setX(memory, hart, rd, ux(x(memory, hart, rd)) << shift);
    } else if (funct === 1) {
      const offset = instruction << 4 & 0x1c0 | instruction >>> 7 & 0x20 | instruction >>> 2 & 0x18;
      if (rd === 0 || !loadFloating(memory, hart, rd, 3, x(memory, hart, 2) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 2) {
      const offset = instruction << 4 & 0xc0 | instruction >>> 7 & 0x20 | instruction >>> 2 & 0x1c;
      if (rd === 0 || !loadInteger(memory, hart, rd, 2, x(memory, hart, 2) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 3) {
      const offset = instruction << 4 & 0x1c0 | instruction >>> 7 & 0x20 | instruction >>> 2 & 0x18;
      if (rd === 0 || !loadInteger(memory, hart, rd, 3, x(memory, hart, 2) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 4) {
      const high = instruction >>> 12 & 1;
      if (high === 0 && rs === 0) {
        if (rd === 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
        setPc(memory, hart, ux(x(memory, hart, rd)));
      } else if (high === 0) {
        if (rd === 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
        setX(memory, hart, rd, x(memory, hart, rs));
      } else if (rs === 0 && rd === 0) return fault(memory, hart, TETO_FAULT_BREAKPOINT, instruction);
      else if (rs === 0) {
        const target = ux(x(memory, hart, rd));
        setX(memory, hart, 1, sx(atPc + 2n, 64));
        setPc(memory, hart, target);
      } else {
        if (rd === 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
        setX(memory, hart, rd, x(memory, hart, rd) + x(memory, hart, rs));
      }
    } else if (funct === 5) {
      const offset = instruction >>> 1 & 0x1c0 | instruction >>> 7 & 0x38;
      if (!storeFloating(memory, hart, rs, 3, x(memory, hart, 2) + word(offset))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 6) {
      const offset = instruction >>> 1 & 0xc0 | instruction >>> 7 & 0x3c;
      if (!storeInteger(memory, hart, 2, x(memory, hart, 2) + word(offset), x(memory, hart, rs))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else if (funct === 7) {
      const offset = instruction >>> 1 & 0x1c0 | instruction >>> 7 & 0x38;
      if (!storeInteger(memory, hart, 3, x(memory, hart, 2) + word(offset), x(memory, hart, rs))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
    } else return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
    return TETO_BATCH_BUDGET;
  }
  return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
};

const step = (memory: TetoMemory, hart: U32, nowMicros: I64): I32 => {
  const base = hartAt(hart);
  const atPc = loadU64(memory, base + H_PC);
  if (!guestAllowed(memory, hart, atPc, 2, TETO_SEGMENT_EXECUTE)) return fault(memory, hart, TETO_FAULT_MEMORY, 0);
  const half = wordToU32(guestLoadU64(memory, hart, atPc, 2));
  if ((half & 3) !== 3) {
    setPc(memory, hart, atPc + 2n);
    return compressedStep(memory, hart, half, atPc);
  }
  if (!guestAllowed(memory, hart, atPc, 4, TETO_SEGMENT_EXECUTE)) return fault(memory, hart, TETO_FAULT_MEMORY, 0);
  const instruction = wordToU32(guestLoadU64(memory, hart, atPc, 4));
  storeU32(memory, base + H_LAST_INSTRUCTION, instruction);
  setPc(memory, hart, atPc + 4n);
  const opcode = instruction & 0x7f;
  const destination = instruction >>> 7 & 31;
  const funct3 = instruction >>> 12 & 7;
  const sourceA = instruction >>> 15 & 31;
  const sourceB = instruction >>> 20 & 31;
  const top = instruction >>> 25;
  const left = x(memory, hart, sourceA);
  const right = x(memory, hart, sourceB);
  if (opcode === 0x03) {
    if (!loadInteger(memory, hart, destination, funct3, left + immediateI(instruction))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
  } else if (opcode === 0x07) {
    if (!loadFloating(memory, hart, destination, funct3, left + immediateI(instruction))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
  } else if (opcode === 0x0f) {
    return TETO_BATCH_BUDGET;
  } else if (opcode === 0x13) {
    if (!opImmediate(memory, hart, destination, funct3, instruction, left)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x17) setX(memory, hart, destination, sx(atPc + ux(immediateU(instruction)), 64));
  else if (opcode === 0x1b) {
    if (!opImmediateWord(memory, hart, destination, funct3, instruction, left)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x23) {
    if (!storeInteger(memory, hart, funct3, left + immediateS(instruction), right)) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
  } else if (opcode === 0x27) {
    if (!storeFloating(memory, hart, sourceB, funct3, left + immediateS(instruction))) return fault(memory, hart, TETO_FAULT_MEMORY, instruction);
  } else if (opcode === 0x2f) {
    const result = atomicInstruction(memory, hart, destination, funct3, instruction, left, right);
    if (result === TETO_BATCH_CONTENDED) {
      setPc(memory, hart, atPc);
      return result;
    }
    if (result === TETO_BATCH_FAULT) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x33) {
    if (!opRegister(memory, hart, destination, funct3, top, left, right)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x37) setX(memory, hart, destination, immediateU(instruction));
  else if (opcode === 0x3b) {
    if (!opRegisterWord(memory, hart, destination, funct3, top, left, right)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x43 || opcode === 0x47 || opcode === 0x4b || opcode === 0x4f) {
    if (!floatingMultiplyAdd(memory, hart, opcode, destination, instruction, sourceA, sourceB)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x53) {
    if (!floatingOperation(memory, hart, destination, funct3, top, sourceA, sourceB, instruction)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else if (opcode === 0x63) {
    const take = branch(funct3, left, right);
    if (take < 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
    if (take !== 0) setPc(memory, hart, atPc + ux(immediateB(instruction)));
  } else if (opcode === 0x67) {
    if (funct3 !== 0) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
    const target = ux(left + immediateI(instruction)) & ~1n;
    setX(memory, hart, destination, sx(atPc + 4n, 64));
    setPc(memory, hart, target);
  } else if (opcode === 0x6f) {
    setX(memory, hart, destination, sx(atPc + 4n, 64));
    setPc(memory, hart, atPc + ux(immediateJ(instruction)));
  } else if (opcode === 0x73) {
    if (instruction === 0x00000073) {
      return kernelSyscall(memory, hart);
    }
    if (instruction === 0x00100073) return fault(memory, hart, TETO_FAULT_BREAKPOINT, instruction);
    if (!csr(memory, hart, destination, funct3, instruction, left, sourceA, nowMicros)) return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  } else return fault(memory, hart, TETO_FAULT_INSTRUCTION, instruction);
  return TETO_BATCH_BUDGET;
};

const runHartLocked = (
  memory: TetoMemory,
  hart: U32,
  budget: U32,
  nowMicros: I64,
  worker: I32,
): I32 => {
  const at = hartAt(hart);
  bump(memory, at + H_HOST_TO_WASM);
  const previousWorker = loadI32(memory, at + H_LAST_WORKER);
  if (previousWorker >= 0 && previousWorker !== worker) bump(memory, at + H_MIGRATIONS);
  storeI32(memory, at + H_LAST_WORKER, worker);
  atomicAddI32(memory, TETO_CONTROL_BASE + C_ACTIVE_WORKERS, 1);
  let result = TETO_BATCH_BUDGET;
  let count: U32 = 0;
  const status = atomicLoadI32(memory, at + H_STATUS);
  if (status === TETO_HART_EXITED) result = TETO_BATCH_EXITED;
  else if (status === TETO_HART_FAULTED) result = TETO_BATCH_FAULT;
  else if (status !== TETO_HART_RUNNABLE) result = TETO_BATCH_BUSY;
  else {
    while (count < budget && result === TETO_BATCH_BUDGET) {
      result = step(memory, hart, nowMicros);
      bump(memory, at + H_INSTRUCTIONS);
      count += 1;
    }
  }
  if (result === TETO_BATCH_CONTENDED) bump(memory, at + H_SYNC_WAITS);
  atomicAddI32(memory, TETO_CONTROL_BASE + C_ACTIVE_WORKERS, -1);
  bump(memory, at + H_WASM_TO_HOST);
  if (worker >= 0 && wordToU32(word(worker)) < loadU32(memory, TETO_CONTROL_BASE + C_WORKER_CAPACITY)) {
    const workerState = workerAt(wordToU32(word(worker)));
    bump(memory, workerState + W_BATCHES);
    atomicAddU64(memory, workerState + W_INSTRUCTIONS, ux(word(count)));
  }
  release(memory, at + H_LOCK);
  return result;
};

export const tetoRunRv64Batch = (
  memory: TetoMemory,
  hart: U32,
  budget: U32,
  nowMicros: I64,
  worker: I32,
): I32 => {
  if (!tetoKernelValid(memory) || !validHart(memory, hart) || budget < 1) return TETO_BATCH_FAULT;
  const at = hartAt(hart);
  if (!acquire(memory, at + H_LOCK)) {
    bump(memory, at + H_LOCK_CONTENTION);
    return TETO_BATCH_BUSY;
  }
  return runHartLocked(memory, hart, budget, nowMicros, worker);
};

export const tetoRunSchedulerBatch = (
  memory: TetoMemory,
  budget: U32,
  nowMicros: I64,
  worker: I32,
): I32 => {
  if (!tetoKernelValid(memory) || budget < 1 || worker < 0) return TETO_BATCH_FAULT;
  const workerId = wordToU32(word(worker));
  const workerCapacity = loadU32(memory, TETO_CONTROL_BASE + C_WORKER_CAPACITY);
  if (workerId >= workerCapacity) return TETO_BATCH_FAULT;
  const lock = TETO_CONTROL_BASE + C_SCHED_LOCK;
  if (!acquire(memory, lock)) {
    bump(memory, TETO_CONTROL_BASE + C_SCHED_CONTENTION);
    return TETO_BATCH_CONTENDED;
  }
  const maxHarts = loadU32(memory, TETO_CONTROL_BASE + C_MAX_HARTS);
  const start = loadU32(memory, TETO_CONTROL_BASE + C_SCHED_CURSOR) % maxHarts;
  let scan: U32 = 0;
  while (scan < maxHarts) {
    const hart = (start + scan) % maxHarts;
    const at = hartAt(hart);
    if (atomicLoadI32(memory, at + H_STATUS) === TETO_HART_RUNNABLE) {
      if (acquire(memory, at + H_LOCK)) {
        storeU32(memory, TETO_CONTROL_BASE + C_SCHED_CURSOR, (hart + 1) % maxHarts);
        release(memory, lock);
        bump(memory, TETO_CONTROL_BASE + C_SCHED_RUNS);
        bump(memory, TETO_CONTROL_BASE + C_SCHED_CLAIMS);
        const result = runHartLocked(memory, hart, budget, nowMicros, worker);
        return wordToI32(word((hart + 1) * 256 + (wordToU32(word(result)) & 255)));
      }
      bump(memory, at + H_LOCK_CONTENTION);
    }
    scan += 1;
  }
  release(memory, lock);
  bump(memory, TETO_CONTROL_BASE + C_SCHED_IDLE);
  bump(memory, workerAt(workerId) + W_IDLE);
  return 0;
};

export const tetoWorkerMetric = (memory: TetoMemory, worker: U32, offset: U32): U64 => {
  if (!tetoKernelValid(memory) || worker >= loadU32(memory, TETO_CONTROL_BASE + C_WORKER_CAPACITY) ||
      offset + 8 > TETO_WORKER_STRIDE || (offset & 7) !== 0) return 0n;
  return atomicLoadU64(memory, workerAt(worker) + offset);
};

export const tetoResumeSyscall = (memory: TetoMemory, hart: U32, result: I64): I32 => {
  if (!validHart(memory, hart)) return TETO_FAULT_BAD_STATE;
  const at = hartAt(hart);
  if (!acquire(memory, at + H_LOCK)) return TETO_BATCH_BUSY;
  if (atomicLoadI32(memory, at + H_STATUS) !== TETO_HART_WAITING || loadI32(memory, at + H_EVENT) !== TETO_EVENT_SYSCALL) {
    release(memory, at + H_LOCK);
    return TETO_FAULT_BAD_STATE;
  }
  setX(memory, hart, 10, result);
  storeI32(memory, at + H_EVENT, TETO_EVENT_NONE);
  atomicStoreI32(memory, at + H_STATUS, TETO_HART_RUNNABLE);
  const proc = processForHart(memory, hart);
  if (proc !== INVALID_POINTER) atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_RUNNABLE);
  release(memory, at + H_LOCK);
  return 0;
};

export const tetoResumeHost = (memory: TetoMemory, hart: U32, result: I64): I32 => {
  if (!validHart(memory, hart)) return TETO_FAULT_BAD_STATE;
  const at = hartAt(hart);
  if (!acquire(memory, at + H_LOCK)) return TETO_BATCH_BUSY;
  if (atomicLoadI32(memory, at + H_STATUS) !== TETO_HART_WAITING || loadI32(memory, at + H_EVENT) !== TETO_EVENT_HOST) {
    release(memory, at + H_LOCK);
    return TETO_FAULT_BAD_STATE;
  }
  setX(memory, hart, 10, result);
  storeI32(memory, at + H_HOST_OPERATION, TETO_HOST_NONE);
  storeI32(memory, at + H_HOST_DESCRIPTOR, -1);
  storeU64(memory, at + H_HOST_ADDRESS, 0n);
  storeU32(memory, at + H_HOST_LENGTH, 0);
  storeI32(memory, at + H_EVENT, TETO_EVENT_NONE);
  atomicStoreI32(memory, at + H_STATUS, TETO_HART_RUNNABLE);
  const proc = processForHart(memory, hart);
  if (proc !== INVALID_POINTER) atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_RUNNABLE);
  release(memory, at + H_LOCK);
  return 0;
};

export const tetoExitHart = (memory: TetoMemory, hart: U32, code: I32): I32 => {
  if (!validHart(memory, hart)) return TETO_FAULT_BAD_STATE;
  const at = hartAt(hart);
  if (!acquire(memory, at + H_LOCK)) return TETO_BATCH_BUSY;
  setX(memory, hart, 10, word(code));
  const proc = processForHart(memory, hart);
  if (proc !== INVALID_POINTER) {
    atomicStoreI32(memory, proc + P_EXIT_CODE, code);
    atomicStoreI32(memory, proc + P_STATE, TETO_PROCESS_ZOMBIE);
  }
  storeI32(memory, at + H_EVENT, TETO_EVENT_NONE);
  atomicStoreI32(memory, at + H_STATUS, TETO_HART_EXITED);
  release(memory, at + H_LOCK);
  return 0;
};
