import { bad } from "../core/err.js";

export const PG = 65536;

export class Mem64 {
  readonly page = new Map<number, Uint8Array>();
  used = 0;

  constructor(readonly top: bigint, readonly cap: number) {
    if (top < 1024n * 1024n || top > BigInt(Number.MAX_SAFE_INTEGER)) bad("ENOEXEC", "bad thistle64 virtual memory size");
    if (!Number.isSafeInteger(cap) || cap < PG) bad("ENOMEM", "bad thistle64 host memory budget");
  }

  read(at: bigint, n: number): Uint8Array {
    this.chk(at, n);
    const out = new Uint8Array(n);
    this.each(at, n, (p, off, len, dst) => { const q = this.page.get(p); if (q) out.set(q.subarray(off, off + len), dst); });
    return out;
  }

  write(at: bigint, b: Uint8Array): void {
    this.chk(at, b.length);
    this.each(at, b.length, (p, off, len, src) => {
      const x = b.subarray(src, src + len);
      let q = this.page.get(p);
      if (!q && x.some(v => v !== 0)) q = this.make(p);
      q?.set(x, off);
    });
  }

  u8(at: bigint): number { return this.read(at, 1)[0]!; }
  i8(at: bigint): bigint { return BigInt.asIntN(8, BigInt(this.u8(at))); }
  u16(at: bigint): number { const b = this.read(at, 2); return b[0]! | b[1]! << 8; }
  i16(at: bigint): bigint { return BigInt.asIntN(16, BigInt(this.u16(at))); }
  u32(at: bigint): number { const b = this.read(at, 4); return (b[0]! | b[1]! << 8 | b[2]! << 16 | b[3]! << 24) >>> 0; }
  i32(at: bigint): bigint { return BigInt.asIntN(32, BigInt(this.u32(at))); }

  u64(at: bigint): bigint {
    const b = this.read(at, 8);
    let n = 0n;
    for (let i = 7; i >= 0; i--) n = n << 8n | BigInt(b[i]!);
    return n;
  }

  i64(at: bigint): bigint { return BigInt.asIntN(64, this.u64(at)); }

  f32(at: bigint): number {
    const b = this.read(at, 4);
    return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat32(0, true);
  }

  f64(at: bigint): number {
    const b = this.read(at, 8);
    return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat64(0, true);
  }

  set8(at: bigint, n: bigint | number): void { this.write(at, Uint8Array.of(Number(n) & 255)); }
  set16(at: bigint, n: bigint | number): void { this.setN(at, BigInt(n), 2); }
  set32(at: bigint, n: bigint | number): void { this.setN(at, BigInt(n), 4); }
  set64(at: bigint, n: bigint | number): void { this.setN(at, BigInt(n), 8); }

  setF32(at: bigint, n: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, n, true);
    this.write(at, b);
  }

  setF64(at: bigint, n: number): void {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, n, true);
    this.write(at, b);
  }

  private setN(at: bigint, n: bigint, z: number): void {
    const b = new Uint8Array(z), x = BigInt.asUintN(z * 8, n);
    for (let i = 0; i < z; i++) b[i] = Number(x >> BigInt(i * 8) & 255n);
    this.write(at, b);
  }

  private chk(at: bigint, n: number): void {
    if (at < 0n || !Number.isSafeInteger(n) || n < 0 || at + BigInt(n) > this.top) bad("ERANGE", `thistle64 address 0x${at.toString(16)}`);
  }

  private each(at: bigint, n: number, fn: (page: number, off: number, len: number, pos: number) => void): void {
    let p = 0;
    while (p < n) {
      const q = at + BigInt(p), page = Number(q / BigInt(PG)), off = Number(q % BigInt(PG)), len = Math.min(n - p, PG - off);
      fn(page, off, len, p);
      p += len;
    }
  }

  private make(n: number): Uint8Array {
    if (this.used + PG > this.cap) bad("ENOMEM", `thistle64 touched-page budget ${this.cap} bytes exhausted`);
    const p = new Uint8Array(PG);
    this.page.set(n, p);
    this.used += PG;
    return p;
  }
}
