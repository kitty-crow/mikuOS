import { requireValue } from "../core/err.js";
import { bad } from "../core/err.js";
import type { RvMemory } from "../vm/mem64.js";
import { H_PAGE_COUNT, THISTLE_GUEST_PAGE_SIZE as TETO_GUEST_PAGE_SIZE, THISTLE_HART_BASE as TETO_HART_BASE, THISTLE_HART_STRIDE as TETO_HART_STRIDE } from "./abi.js";
import { thistleGuestPage as tetoGuestPage } from "./kernel.js";
import { loadU32 } from "./memory.js";
import type { ThistleMemory as TetoMemory } from "./memory.js";

const INVALID = 0xffffffff;
const UNMAPPED = 0xfffffffe;
export type TetoPageLookup = (hart: number, address: bigint, create: boolean) => number;

/** Direct-Thistle view of the sparse memory representation also generated into Teto. */
export class TetoMem64 implements RvMemory {
  constructor(
    private readonly memory: TetoMemory,
    private readonly hart: number,
    readonly top: bigint,
    readonly cap: number,
    private readonly page: TetoPageLookup = (hart, address, create) => tetoGuestPage(memory, hart, address, create),
  ) {}

  get used(): number {
    const state = TETO_HART_BASE + this.hart * TETO_HART_STRIDE;
    return loadU32(this.memory, state + H_PAGE_COUNT) * TETO_GUEST_PAGE_SIZE;
  }

  read(at: bigint, n: number): Uint8Array {
    this.check(at, n);
    const output = new Uint8Array(n);
    let position = 0;
    while (position < n) {
      const address = at + BigInt(position);
      const offset = Number(address & 0xffffn);
      const length = Math.min(n - position, TETO_GUEST_PAGE_SIZE - offset);
      const frame = this.page(this.hart, address, false) >>> 0;
      switch (true) {
case !!(frame < UNMAPPED): { output.set(this.memory.bytes.subarray(frame + offset, frame + offset + length), position);
break; }
case !!(frame === INVALID): { bad("ENOMEM", "Teto page-table lookup failed");
break; }
}
      position += length;
    }
    return output;
  }

  write(at: bigint, bytes: Uint8Array): void {
    this.check(at, bytes.length);
    let position = 0;
    while (position < bytes.length) {
      const address = at + BigInt(position);
      const offset = Number(address & 0xffffn);
      const length = Math.min(bytes.length - position, TETO_GUEST_PAGE_SIZE - offset);
      const part = bytes.subarray(position, position + length);
      let frame = this.page(this.hart, address, false) >>> 0;
      if (frame === UNMAPPED && part.some(value => value !== 0)) frame = this.page(this.hart, address, true) >>> 0;
      if (frame === INVALID) bad("ENOMEM", "Teto physical-memory budget exhausted");
      if (frame < UNMAPPED) this.memory.bytes.set(part, frame + offset);
      position += length;
    }
  }

  drop(at: bigint, n: number): void {
    this.check(at, n);
    let position = 0;
    while (position < n) {
      const address = at + BigInt(position);
      const offset = Number(address & 0xffffn);
      const length = Math.min(n - position, TETO_GUEST_PAGE_SIZE - offset);
      const frame = this.page(this.hart, address, false) >>> 0;
      switch (true) {
case !!(frame < UNMAPPED): { this.memory.bytes.fill(0, frame + offset, frame + offset + length);
break; }
case !!(frame === INVALID): { bad("ENOMEM", "Teto page-table lookup failed");
break; }
}
      position += length;
    }
  }

  u8(at: bigint): number { return requireValue(this.read(at, 1)[0] ?? null, "src/teto/mem64.ts:73"); }
  i8(at: bigint): bigint { return BigInt.asIntN(8, BigInt(this.u8(at))); }
  u16(at: bigint): number { return this.number(at, 2); }
  i16(at: bigint): bigint { return BigInt.asIntN(16, BigInt(this.u16(at))); }
  u32(at: bigint): number { return this.number(at, 4) >>> 0; }
  i32(at: bigint): bigint { return BigInt.asIntN(32, BigInt(this.u32(at))); }

  u64(at: bigint): bigint {
    const bytes = this.read(at, 8);
    let value = 0n;
    for (let index = 7; index >= 0; index--) value = value << 8n | BigInt(requireValue(bytes[index] ?? null, "src/teto/mem64.ts:83"));
    return value;
  }

  i64(at: bigint): bigint { return BigInt.asIntN(64, this.u64(at)); }

  f32(at: bigint): number {
    const bytes = this.read(at, 4);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, true);
  }

  f64(at: bigint): number {
    const bytes = this.read(at, 8);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(0, true);
  }

  set8(at: bigint, n: bigint | number): void { this.write(at, Uint8Array.of(Number(BigInt.asUintN(8, BigInt(n))))); }
  set16(at: bigint, n: bigint | number): void { this.setNumber(at, BigInt(n), 2); }
  set32(at: bigint, n: bigint | number): void { this.setNumber(at, BigInt(n), 4); }
  set64(at: bigint, n: bigint | number): void { this.setNumber(at, BigInt(n), 8); }

  setF32(at: bigint, n: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, n, true);
    this.write(at, bytes);
  }

  setF64(at: bigint, n: number): void {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, n, true);
    this.write(at, bytes);
  }

  private number(at: bigint, size: number): number {
    const bytes = this.read(at, size);
    let value = 0;
    for (let index = size - 1; index >= 0; index--) value = value * 256 + requireValue(bytes[index] ?? null, "src/teto/mem64.ts:119");
    return value;
  }

  private setNumber(at: bigint, n: bigint, size: number): void {
    const value = BigInt.asUintN(size * 8, n);
    const bytes = new Uint8Array(size);
    for (let index = 0; index < size; index++) bytes[index] = Number(value >> BigInt(index * 8) & 255n);
    this.write(at, bytes);
  }

  private check(at: bigint, n: number): void {
    if (at < 0n || !Number.isSafeInteger(n) || n < 0 || at + BigInt(n) > this.top) {
      bad("ERANGE", `thistle64 address 0x${at.toString(16)}`);
    }
  }
}
