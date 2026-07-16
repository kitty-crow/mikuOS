import { Exe } from "../asm/fmt.js";

const EI_NIDENT = 16;
const ET_EXEC = 2;
const EM_RISCV = 243;
const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const PT_INTERP = 3;
const PT_PHDR = 6;
const PF_X = 1;
const PF_W = 2;
const PF_R = 4;
const MAX_MEM = 1024 * 1024 * 1024 * 1024;

export class ElfErr extends Error {
  constructor(message: string) { super(message); this.name = "ElfErr"; }
}

const fail = (s: string): never => { throw new ElfErr(s); };

const nat = (n: bigint, k: string): number => {
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${k} is outside Thistle's address range`);
  return Number(n);
};

const pow2 = (n: number): boolean => {
  if (n <= 0 || !Number.isSafeInteger(n)) return false;
  const q = BigInt(n);
  return (q & (q - 1n)) === 0n;
};

export const isElf = (b: Uint8Array): boolean => b.length >= EI_NIDENT && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46;

/** Import a linked RV64 executable. Relocating an ELF at runtime is a different job, so dynamic files are refused here. */
export class Elf {
  run(b: Uint8Array, name = "a.out"): Exe {
    if (!isElf(b)) fail(`${name}: not an ELF file`);
    if (b.length < 64) fail(`${name}: truncated ELF header`);
    if (b[4] !== 2 || b[5] !== 1 || b[6] !== 1) fail(`${name}: expected ELF64 little-endian version 1`);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (v.getUint16(16, true) !== ET_EXEC) fail(`${name}: only linked ET_EXEC files can become THX`);
    if (v.getUint16(18, true) !== EM_RISCV) fail(`${name}: expected a RISC-V executable`);
    if (v.getUint32(20, true) !== 1) fail(`${name}: unsupported ELF version`);

    const entry = nat(v.getBigUint64(24, true), "ELF entry"), phoff = nat(v.getBigUint64(32, true), "program header offset");
    const ehz = v.getUint16(52, true), phz = v.getUint16(54, true), phn = v.getUint16(56, true);
    if (ehz !== 64 || phz !== 56 || !phn || phoff + phz * phn > b.length) fail(`${name}: bad ELF program header table`);

    const x = new Exe("thistle64");
    x.isa = "rv64gc";
    x.entry = entry;
    x.mem = MAX_MEM;
    x.phent = phz;
    x.phnum = phn;
    x.ident.push(`ELF64 RISC-V imported from ${name}`);
    let loads = 0;
    let end = 0;

    for (let i = 0; i < phn; i++) {
      const at = phoff + i * phz, typ = v.getUint32(at, true), fl = v.getUint32(at + 4, true);
      const off = nat(v.getBigUint64(at + 8, true), `segment ${i} offset`);
      const va = nat(v.getBigUint64(at + 16, true), `segment ${i} address`);
      const fz = nat(v.getBigUint64(at + 32, true), `segment ${i} file size`);
      const mz = nat(v.getBigUint64(at + 40, true), `segment ${i} memory size`);
      const al0 = nat(v.getBigUint64(at + 48, true), `segment ${i} alignment`);
      if (typ === PT_INTERP || typ === PT_DYNAMIC) fail(`${name}: dynamic ELF files are not self-contained`);
      if (typ === PT_PHDR) x.phdr = va;
      if (typ !== PT_LOAD || !mz) continue;
      if (fz > mz || off + fz > b.length || va < 0x10000 || va + mz > x.mem) fail(`${name}: bad load segment ${i}`);
      if (al0 > 1 && !pow2(al0)) fail(`${name}: segment ${i} alignment is not a power of two`);
      let al = Math.min(al0 || 1, 65536);
      while (al > 1 && va % al) al >>= 1;
      const flg = `${fl & PF_R ? "r" : ""}${fl & PF_W ? "w" : ""}${fl & PF_X ? "x" : ""}`;
      x.sec.push({ name: `.elf.${loads++}`, flg, align: al, data: b.slice(off, off + fz), size: mz, addr: va });
      end = Math.max(end, va + mz);
      if (!x.phdr && phoff >= off && phoff + phz * phn <= off + fz) x.phdr = va + phoff - off;
    }

    if (!loads || !x.sec.some(s => s.flg.includes("x") && entry >= s.addr && entry < s.addr + s.size)) fail(`${name}: entry point is not in an executable load segment`);
    if (!x.phdr) {
      const at = Math.ceil(end / 16) * 16, z = phz * phn;
      if (at + z > x.mem) fail(`${name}: no address remains for the ELF program headers`);
      x.phdr = at;
      x.sec.push({ name: ".elf.phdr", flg: "r", align: 16, data: b.slice(phoff, phoff + z), size: z, addr: at });
    }
    return x;
  }
}

export const elf = new Elf();
