const MB = 1024 * 1024;
const GB = 1024 * MB;

interface Host {
  navigator?: { deviceMemory?: number };
  process?: {
    env?: Record<string, string | undefined>;
    getBuiltinModule?(name: string): { totalmem?(): number };
  };
}

const host = globalThis as unknown as Host;

const ram = (): number => {
  const web = host.navigator?.deviceMemory;
  if (web && Number.isFinite(web)) return web * GB;
  try {
    const n = host.process?.getBuiltinModule?.("os").totalmem?.();
    if (n && Number.isFinite(n)) return n;
  } catch { /* Some hosts quite reasonably keep their RAM to themselves. */ }
  return 2 * GB;
};

const env = (k: string, d: number, zero = false): number => {
  const s = host.process?.env?.[k];
  if (s === undefined || s === "") return d;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0 || (!zero && !n)) throw new Error(`${k} must be ${zero ? "a non-negative" : "a positive"} integer`);
  return n;
};

export class Lim {
  constructor(
    readonly fs: number,
    readonly mem: number,
    readonly stack: number,
    readonly fuel: number,
  ) {}

  static host(): Lim {
    const r = ram();
    // Capacity is sparse: a generous ceiling costs nothing until a program uses it.
    const fs = env("THISTLE_FS_MB", Math.max(2048, Math.min(65536, Math.floor(r / MB / 2)))) * MB;
    const mem = env("THISTLE_MEM_MB", Math.max(512, Math.min(32768, Math.floor(r / MB / 2)))) * MB;
    const stack = env("THISTLE_STACK_MB", Math.max(32, Math.min(1024, Math.floor(mem / MB / 8)))) * MB;
    const fuel = env("THISTLE_FUEL", 10_000_000_000, true);
    return new Lim(fs, mem, stack, fuel);
  }
}
