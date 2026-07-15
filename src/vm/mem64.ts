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

  drop(at: bigint, n: number): void {
    this.chk(at, n);
    if (!n) return;
    const end = at + BigInt(n), first = Number(at / BigInt(PG)), last = Number((end - 1n) / BigInt(PG));
    for (let p = first; p <= last; p++) {
      const q = this.page.get(p); if (!q) continue;
      const base = BigInt(p) * BigInt(PG), lo = Number(at > base ? at - base : 0n), hi = Number(end < base + BigInt(PG) ? end - base : BigInt(PG));
      if (!lo && hi === PG) { this.page.delete(p); this.used -= PG; }
      else q.fill(0, lo, hi);
    }
  }

  u8(at: bigint): number {
    this.chk(at, 1);
    const n = Number(at), q = this.page.get(Math.floor(n / PG));
    return q?.[n % PG] ?? 0;
  }
  i8(at: bigint): bigint { return BigInt.asIntN(8, BigInt(this.u8(at))); }
  u16(at: bigint): number {
    this.chk(at, 2);
    const n = Number(at), off = n % PG;
    if (off > PG - 2) { const b = this.read(at, 2); return b[0]! | b[1]! << 8; }
    const q = this.page.get(Math.floor(n / PG));
    return q ? q[off]! | q[off + 1]! << 8 : 0;
  }
  i16(at: bigint): bigint { return BigInt.asIntN(16, BigInt(this.u16(at))); }
  u32(at: bigint): number {
    this.chk(at, 4);
    const n = Number(at), off = n % PG;
    if (off > PG - 4) { const b = this.read(at, 4); return (b[0]! | b[1]! << 8 | b[2]! << 16 | b[3]! << 24) >>> 0; }
    const q = this.page.get(Math.floor(n / PG));
    return q ? (q[off]! | q[off + 1]! << 8 | q[off + 2]! << 16 | q[off + 3]! << 24) >>> 0 : 0;
  }
  i32(at: bigint): bigint { return BigInt.asIntN(32, BigInt(this.u32(at))); }

  u64(at: bigint): bigint {
    this.chk(at, 8);
    const n0 = Number(at), off = n0 % PG;
    if (off > PG - 8) { const b = this.read(at, 8); let n = 0n; for (let i = 7; i >= 0; i--) n = n << 8n | BigInt(b[i]!); return n; }
    const b = this.page.get(Math.floor(n0 / PG));
    if (!b) return 0n;
    let n = 0n;
    for (let i = 7; i >= 0; i--) n = n << 8n | BigInt(b[off + i]!);
    return n;
  }

  i64(at: bigint): bigint { return BigInt.asIntN(64, this.u64(at)); }

  f32(at: bigint): number {
    this.chk(at, 4);
    const n = Number(at), off = n % PG;
    if (off > PG - 4) { const b = this.read(at, 4); return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat32(0, true); }
    const b = this.page.get(Math.floor(n / PG));
    return b ? new DataView(b.buffer, b.byteOffset + off, 4).getFloat32(0, true) : 0;
  }

  f64(at: bigint): number {
    this.chk(at, 8);
    const n = Number(at), off = n % PG;
    if (off > PG - 8) { const b = this.read(at, 8); return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat64(0, true); }
    const b = this.page.get(Math.floor(n / PG));
    return b ? new DataView(b.buffer, b.byteOffset + off, 8).getFloat64(0, true) : 0;
  }

  set8(at: bigint, n: bigint | number): void {
    this.chk(at, 1);
    const v = Number(BigInt.asUintN(8, BigInt(n))), p = Number(at), page = Math.floor(p / PG), off = p % PG;
    let q = this.page.get(page); if (!q && v) q = this.make(page); if (q) q[off] = v;
  }
  set16(at: bigint, n: bigint | number): void { this.setN(at, BigInt(n), 2); }
  set32(at: bigint, n: bigint | number): void { this.setN(at, BigInt(n), 4); }
  set64(at: bigint, n: bigint | number): void { this.setN(at, BigInt(n), 8); }

  setF32(at: bigint, n: number): void {
    this.chk(at, 4);
    const p = Number(at), off = p % PG;
    if (off > PG - 4) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, n, true); this.write(at, b); return; }
    const page = Math.floor(p / PG); let q = this.page.get(page); if (!q && (n !== 0 || Object.is(n, -0))) q = this.make(page);
    if (q) new DataView(q.buffer, q.byteOffset + off, 4).setFloat32(0, n, true);
  }

  setF64(at: bigint, n: number): void {
    this.chk(at, 8);
    const p = Number(at), off = p % PG;
    if (off > PG - 8) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, n, true); this.write(at, b); return; }
    const page = Math.floor(p / PG); let q = this.page.get(page); if (!q && (n !== 0 || Object.is(n, -0))) q = this.make(page);
    if (q) new DataView(q.buffer, q.byteOffset + off, 8).setFloat64(0, n, true);
  }

  private setN(at: bigint, n: bigint, z: number): void {
    this.chk(at, z);
    const p = Number(at), off = p % PG, x = BigInt.asUintN(z * 8, n);
    if (off > PG - z) { const b = new Uint8Array(z); for (let i = 0; i < z; i++) b[i] = Number(x >> BigInt(i * 8) & 255n); this.write(at, b); return; }
    const page = Math.floor(p / PG); let q = this.page.get(page); if (!q && x) q = this.make(page);
    if (q) for (let i = 0; i < z; i++) q[off + i] = Number(x >> BigInt(i * 8) & 255n);
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
