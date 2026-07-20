import { mkdir, writeFile, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { codec, Exe } from "../../build/asm/fmt.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../mmap-shared.thx");
const textAddr = 0x10000;
const dataAddr = 0x20000;
const pathAddr = dataAddr;
const page = 4096;
const size = page * 3;
const code = [];

const r = { zero: 0, ra: 1, sp: 2, t0: 5, t1: 6, s0: 8, s1: 9, a0: 10, a1: 11, a2: 12, a3: 13, a4: 14, a5: 15, a7: 17 };

const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
const emit = n => code.push(...u32(n));
const bits = (n, width) => Number(BigInt.asUintN(width, BigInt(n)));
const iop = (op, rd, f3, rs1, imm) => emit((bits(imm, 12) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op);
const rop = (op, rd, f3, rs1, rs2, f7 = 0) => emit((f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op);
const sop = (op, f3, rs1, rs2, imm) => {
  const q = bits(imm, 12);
  emit(((q >>> 5) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((q & 31) << 7) | op);
};
const lui = (rd, imm20) => emit((imm20 << 12) | (rd << 7) | 0x37);
const addi = (rd, rs1, imm) => iop(0x13, rd, 0, rs1, imm);
const li = (rd, imm) => {
  if (imm >= -2048 && imm <= 2047) { addi(rd, r.zero, imm); return; }
  const hi = Math.trunc((imm + 0x800) / 0x1000);
  const lo = imm - hi * 0x1000;
  lui(rd, hi);
  if (lo) addi(rd, rd, lo);
};
const la = (rd, addr) => li(rd, addr);
const mv = (rd, rs) => addi(rd, rs, 0);
const add = (rd, rs1, rs2) => rop(0x33, rd, 0, rs1, rs2);
const sb = (rs2, rs1, imm) => sop(0x23, 0, rs1, rs2, imm);
const ecall = () => emit(0x00000073);
const syscall = n => { li(r.a7, n); ecall(); };
const writeString = (base, s) => {
  [...new TextEncoder().encode(s)].forEach((ch, i) => {
    li(r.t0, ch);
    sb(r.t0, base, i);
  });
};

// fd = openat(AT_FDCWD, "/tmp/mmap-shared.out", O_RDWR | O_CREAT | O_TRUNC, 0666)
li(r.a0, -100);
la(r.a1, pathAddr);
li(r.a2, 0x242);
li(r.a3, 0o666);
syscall(56);
mv(r.s0, r.a0);

// ftruncate(fd, 12288)
mv(r.a0, r.s0);
li(r.a1, size);
syscall(46);

// map = mmap(0, 12288, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0)
li(r.a0, 0);
li(r.a1, size);
li(r.a2, 3);
li(r.a3, 1);
mv(r.a4, r.s0);
li(r.a5, 0);
syscall(222);
mv(r.s1, r.a0);

writeString(r.s1, "flushed-at-exit");

li(r.t1, page);
add(r.t1, r.s1, r.t1);
writeString(r.t1, "flushed-by-msync");
mv(r.a0, r.t1);
li(r.a1, page);
li(r.a2, 4);
syscall(227);

li(r.t1, page * 2);
add(r.t1, r.s1, r.t1);
writeString(r.t1, "flushed-by-munmap");
mv(r.a0, r.t1);
li(r.a1, page);
syscall(215);

li(r.a0, 0);
syscall(93);

const data = new TextEncoder().encode("/tmp/mmap-shared.out\0");
const exe = new Exe("thistle64");
exe.isa = "rv64gc";
exe.entry = textAddr;
exe.mem = 1024 * 1024 * 1024 * 1024;
exe.sec.push({ name: ".text", flg: "rx", align: 4096, data: new Uint8Array(code), size: code.length, addr: textAddr });
exe.sec.push({ name: ".rodata", flg: "r", align: 4096, data, size: data.length, addr: dataAddr });
exe.ident.push("Generated RV64 mmap shared flush regression fixture");

await mkdir(dirname(out), { recursive: true });
await writeFile(out, codec.pack(exe));
await chmod(out, 0o755);
