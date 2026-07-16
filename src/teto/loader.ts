export interface TetoExports {
  tetoKernelInit(memory: number, maxHarts: number, threaded: number): number;
  tetoKernelValid(memory: number): number;
  tetoHartInit(memory: number, hart: number, virtualTop: bigint, pc: bigint): number;
  tetoProcessInit(memory: number, hart: number, pid: number, ppid: number, ruid: number, euid: number, suid: number, rgid: number, egid: number, sgid: number): number;
  tetoProcessSetGroup(memory: number, hart: number, index: number, gid: number): number;
  tetoProcessCount(memory: number): number;
  tetoResolvePath(memory: number, hart: number, start: number, path: number, pathLength: number, followFinal: number): number;
  tetoAccessInode(memory: number, hart: number, inode: number, bits: number): number;
  tetoOpenPath(memory: number, hart: number, start: number, path: number, pathLength: number, flags: number): number;
  tetoReadDescriptor(memory: number, hart: number, descriptor: number, output: number, length: number): number;
  tetoSeekDescriptor(memory: number, hart: number, descriptor: number, offset: bigint, whence: number): bigint;
  tetoCloseDescriptor(memory: number, hart: number, descriptor: number): number;
  tetoDescriptorKind(memory: number, hart: number, descriptor: number): number;
  tetoDescriptorInode(memory: number, hart: number, descriptor: number): number;
  tetoDescriptorOffset(memory: number, hart: number, descriptor: number): bigint;
  tetoLoadVfs(memory: number, image: number, imageLength: number): number;
  tetoVfsLoaded(memory: number): number;
  tetoVfsRoot(memory: number): number;
  tetoVfsInodeCount(memory: number): number;
  tetoVfsDentryCount(memory: number): number;
  tetoVfsKind(memory: number, inode: number): number;
  tetoVfsFileSize(memory: number, inode: number): bigint;
  tetoVfsMode(memory: number, inode: number): number;
  tetoVfsUid(memory: number, inode: number): number;
  tetoVfsGid(memory: number, inode: number): number;
  tetoVfsNlink(memory: number, inode: number): number;
  tetoVfsLookup(memory: number, parent: number, name: number, nameLength: number): number;
  tetoVfsReadData(memory: number, inode: number, offset: bigint, output: number, length: number): number;
  tetoProcessSegmentCount(memory: number, hart: number): number;
  tetoProcessMapCount(memory: number, hart: number): number;
  tetoProcessMapAddress(memory: number, hart: number, index: number): bigint;
  tetoProcessMapEnd(memory: number, hart: number, index: number): bigint;
  tetoProcessMapProtection(memory: number, hart: number, index: number): number;
  tetoImageReserve(memory: number, size: number): number;
  tetoImageRelease(memory: number, at: number, size: number): number;
  tetoImageBegin(memory: number, hart: number, virtualTop: bigint, entry: bigint, phdr: bigint, phent: number, phnum: number): number;
  tetoImageSegment(memory: number, hart: number, nameHash: number, nameLength: number, address: bigint, size: bigint, flags: number, imageAt: number, length: number): number;
  tetoImageFinish(memory: number, hart: number, imageBytes: number): number;
  tetoLoadThx(memory: number, hart: number, image: number, imageLength: number): number;
  tetoBuildInitialStack(memory: number, hart: number, startup: number, startupLength: number, stackBytes: number): number;
  tetoGuestPage(memory: number, hart: number, address: bigint, create: number): number;
  tetoHartGetX(memory: number, hart: number, register: number): bigint;
  tetoHartSetX(memory: number, hart: number, register: number, value: bigint): number;
  tetoHartGetF(memory: number, hart: number, register: number): bigint;
  tetoHartSetF(memory: number, hart: number, register: number, value: bigint): number;
  tetoHartPc(memory: number, hart: number): bigint;
  tetoHartVirtualTop(memory: number, hart: number): bigint;
  tetoHartImageFloor(memory: number, hart: number): bigint;
  tetoHartStackBottom(memory: number, hart: number): bigint;
  tetoHartStackPointer(memory: number, hart: number): bigint;
  tetoHartBreak(memory: number, hart: number): bigint;
  tetoHartSetPc(memory: number, hart: number, pc: bigint): number;
  tetoHartStatus(memory: number, hart: number): number;
  tetoHartMetric(memory: number, hart: number, offset: number): bigint;
  tetoHostOperation(memory: number, hart: number): number;
  tetoHostDescriptor(memory: number, hart: number): number;
  tetoHostAddress(memory: number, hart: number): bigint;
  tetoHostLength(memory: number, hart: number): number;
  tetoHartExitCode(memory: number, hart: number): number;
  tetoRunRv64Batch(memory: number, hart: number, budget: number, nowMicros: bigint, worker: number): number;
  tetoRunSchedulerBatch(memory: number, budget: number, nowMicros: bigint, worker: number): number;
  tetoWorkerMetric(memory: number, worker: number, offset: number): bigint;
  tetoResumeSyscall(memory: number, hart: number, result: bigint): number;
  tetoResumeHost(memory: number, hart: number, result: bigint): number;
  tetoExitHart(memory: number, hart: number, code: number): number;
}

export interface TetoLoadOptions {
  threaded?: boolean;
  memory?: WebAssembly.Memory;
  initialPages?: number;
  maximumPages?: number;
}

export type TetoVariant = "baseline" | "threads";

/** Thin-host capability for loading the generated kernel image. */
export interface TetoImageProvider {
  load(variant: TetoVariant): Promise<Uint8Array<ArrayBuffer>>;
}

export interface TetoModule {
  readonly module: WebAssembly.Module;
  readonly instance: WebAssembly.Instance;
  readonly memory: WebAssembly.Memory;
  readonly exports: TetoExports;
  readonly threaded: boolean;
}

const required = [
  "tetoKernelInit",
  "tetoKernelValid",
  "tetoHartInit",
  "tetoProcessInit",
  "tetoProcessSetGroup",
  "tetoProcessCount",
  "tetoResolvePath",
  "tetoAccessInode",
  "tetoOpenPath",
  "tetoReadDescriptor",
  "tetoSeekDescriptor",
  "tetoCloseDescriptor",
  "tetoDescriptorKind",
  "tetoDescriptorInode",
  "tetoDescriptorOffset",
  "tetoLoadVfs",
  "tetoVfsLoaded",
  "tetoVfsRoot",
  "tetoVfsInodeCount",
  "tetoVfsDentryCount",
  "tetoVfsKind",
  "tetoVfsFileSize",
  "tetoVfsMode",
  "tetoVfsUid",
  "tetoVfsGid",
  "tetoVfsNlink",
  "tetoVfsLookup",
  "tetoVfsReadData",
  "tetoProcessSegmentCount",
  "tetoProcessMapCount",
  "tetoProcessMapAddress",
  "tetoProcessMapEnd",
  "tetoProcessMapProtection",
  "tetoImageReserve",
  "tetoImageRelease",
  "tetoImageBegin",
  "tetoImageSegment",
  "tetoImageFinish",
  "tetoLoadThx",
  "tetoBuildInitialStack",
  "tetoGuestPage",
  "tetoHartGetX",
  "tetoHartSetX",
  "tetoHartGetF",
  "tetoHartSetF",
  "tetoHartPc",
  "tetoHartVirtualTop",
  "tetoHartImageFloor",
  "tetoHartStackBottom",
  "tetoHartStackPointer",
  "tetoHartBreak",
  "tetoHartSetPc",
  "tetoHartStatus",
  "tetoHartMetric",
  "tetoHostOperation",
  "tetoHostDescriptor",
  "tetoHostAddress",
  "tetoHostLength",
  "tetoHartExitCode",
  "tetoRunRv64Batch",
  "tetoRunSchedulerBatch",
  "tetoWorkerMetric",
  "tetoResumeSyscall",
  "tetoResumeHost",
  "tetoExitHart",
] as const;

export const loadTeto = async (
  bytes: BufferSource,
  options: TetoLoadOptions = {},
): Promise<TetoModule> => {
  const threaded = options.threaded ?? false;
  const module = await WebAssembly.compile(bytes);
  const imports = WebAssembly.Module.imports(module);
  if (imports.length !== 1 || imports[0]?.module !== "env" || imports[0]?.name !== "memory" || imports[0]?.kind !== "memory") {
    throw new Error("Teto module has an unsupported host import surface");
  }
  const memory = options.memory ?? new WebAssembly.Memory({
    initial: options.initialPages ?? 1024,
    maximum: options.maximumPages ?? 32768,
    shared: threaded,
  });
  const instance = await WebAssembly.instantiate(module, { env: { memory } });
  const exports = instance.exports as unknown as TetoExports;
  for (const name of required) {
    if (typeof exports[name] !== "function") throw new Error(`Teto module is missing ${name}`);
  }
  return { module, instance, memory, exports, threaded };
};
