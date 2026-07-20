import { App } from "./base.js";
import type { Sys } from "../core/sys.js";
import { bad } from "../core/err.js";
import { norm } from "../fs/vfs.js";
import { Asm } from "../asm/asm.js";
import { Link } from "../asm/link.js";
import { Bin, Exe, Obj, codec } from "../asm/fmt.js";
import type { Rel, Sec, Sym } from "../asm/fmt.js";
import { decode, I_SZ, text } from "../asm/isa.js";
import { decode64, I64_SZ, text64 } from "../asm/isa64.js";
import { hex } from "../asm/syn.js";
import { elf } from "../elf/elf.js";

const dir = (p: string): string => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) || "/" : ".";
const put = (s: Sys, p: string, b: Uint8Array, mode: number): void => { s.writeb(p, b); s.chmod(p, mode); };

abstract class ToolApp extends App {
  protected bin(s: Sys, p: string): Bin {
    try { return codec.unpack(s.readb(p)); }
    catch (e) { return bad("ENOEXEC", `${p}: ${e instanceof Error ? e.message : String(e)}`); }
  }

  protected val(a: string[], i: number, k: string): string {
    const x = a[i + 1]; if (!x) return bad("EINVAL", `${k} needs a value`); a.splice(i, 2); return x;
  }
}

export class AsApp extends ToolApp {
  constructor() { super("as", "Assemble Thistle64 or compatibility Thistle32 source.", "as [--64|--32] [-g] [-I dir] [-D name[=value]] [-o file] [--listing file] source"); }
  override async run(s: Sys, av: string[]): Promise<number> {
    const a = [...av], inc: string[] = [], defs: Record<string, string> = {};
    let out = "a.to", list = "", debug = false, arch: "thistle32" | "thistle64" = "thistle64";
    for (let i = 0; i < a.length;) {
      const x = a[i]!;
      if (x === "-g") { debug = true; a.splice(i, 1); }
      else if (x === "--64" || x === "-m64") { arch = "thistle64"; a.splice(i, 1); }
      else if (x === "--32" || x === "-m32") { arch = "thistle32"; a.splice(i, 1); }
      else if (x === "-o") out = this.val(a, i, "-o");
      else if (x === "--listing" || x === "-al") list = this.val(a, i, x);
      else if (x === "-I") inc.push(this.val(a, i, "-I"));
      else if (x.startsWith("-I") && x.length > 2) { inc.push(x.slice(2)); a.splice(i, 1); }
      else if (x === "-D") { const q = this.val(a, i, "-D"), n = q.indexOf("="); defs[n < 0 ? q : q.slice(0, n)] = n < 0 ? "1" : q.slice(n + 1); }
      else if (x.startsWith("-D") && x.length > 2) { const q = x.slice(2), n = q.indexOf("="); defs[n < 0 ? q : q.slice(0, n)] = n < 0 ? "1" : q.slice(n + 1); a.splice(i, 1); }
      else if (x.startsWith("-" ) && x !== "-") bad("EINVAL", `as: unknown option ${x}`);
      else i++;
    }
    if (a.length > 1) bad("EINVAL", "as: one translation unit is accepted per object");
    const file = a[0] ?? "-", src = file === "-" ? await s.input() : s.read(file);
    const load = (name: string, from: string) => {
      const q = name.startsWith("/") ? [name] : [norm(`${dir(from)}/${name}`, s.cwd), ...inc.map(x => norm(`${x}/${name}`, s.cwd)), norm(`/usr/include/${name}`)];
      for (const p of q) try { return { src: s.read(p), file: p }; } catch { /* Search paths are meant to miss. */ }
      throw new Error(`include not found: ${name}`);
    };
    const z = new Asm(load, { debug, defs, arch }).run(src, file === "-" ? "<stdin>" : norm(file, s.cwd));
    for (const w of z.warn) await s.err(`as: warning: ${w}\n`);
    const b = codec.pack(z.obj); if (out === "-") await s.out(b); else put(s, out, b, 0o644);
    if (list) s.write(list, z.list);
    return 0;
  }
}

export class LdApp extends ToolApp {
  constructor() { super("ld", "Link Thistle objects into a native executable.", "ld [-e symbol] [-o file] [--Map file] [--image-base n] [--memory n] object ..."); }
  override async run(s: Sys, av: string[]): Promise<number> {
    const a = [...av], files: string[] = [];
    let out = "a.txe", entry = "_start", map = "", base: number | undefined, mem: number | undefined;
    for (let i = 0; i < a.length;) {
      const x = a[i]!;
      if (x === "-o") out = this.val(a, i, "-o");
      else if (x === "-e") entry = this.val(a, i, "-e");
      else if (x === "--Map" || x === "-Map") map = this.val(a, i, x);
      else if (x === "--image-base") base = Number(this.val(a, i, x));
      else if (x === "--memory") mem = Number(this.val(a, i, x));
      else if (x.startsWith("-")) bad("EINVAL", `ld: unknown option ${x}`);
      else { files.push(x); i++; }
    }
    if (!files.length) bad("EINVAL", "ld: no input objects");
    const os = files.map(p => { const x = this.bin(s, p); return x instanceof Obj ? x : bad("ENOEXEC", `${p}: not a relocatable object`); });
    const opt: { entry: string; names: string[]; base?: number; mem?: number } = { entry, names: files };
    if (base !== undefined) { if (!Number.isSafeInteger(base) || base < 0) bad("EINVAL", "ld: bad image base"); opt.base = base; }
    if (mem !== undefined) { if (!Number.isSafeInteger(mem) || mem < 0) bad("EINVAL", "ld: bad memory size"); opt.mem = mem; }
    const z = new Link().run(os, opt), b = codec.pack(z.exe); if (out === "-") await s.out(b); else put(s, out, b, 0o755);
    if (map) s.write(map, z.map); return 0;
  }
}

export class Elf2ThxApp extends ToolApp {
  constructor() { super("elf2thx", "Import a static RV64 ELF executable into THX.", "elf2thx [-o file] input"); }
  override async run(s: Sys, av: string[]): Promise<number> {
    const a = [...av];
    let out = "a.thx";
    for (let i = 0; i < a.length;) {
      if (a[i] === "-o") out = this.val(a, i, "-o");
      else if (a[i]!.startsWith("-")) bad("EINVAL", `elf2thx: unknown option ${a[i]}`);
      else i++;
    }
    if (a.length !== 1) bad("EINVAL", "elf2thx: one input ELF is required");
    let x;
    try { x = elf.run(s.readb(a[0]!), a[0]); }
    catch (e) { return bad("ENOEXEC", e instanceof Error ? e.message : String(e)); }
    const b = codec.pack(x);
    if (out === "-") await s.out(b); else put(s, out, b, 0o755);
    return 0;
  }
}

export class DisApp extends ToolApp {
  constructor(name = "dis") { super(name, "Inspect and disassemble Thistle objects and executables.", `${name} [-hdr] file ...`); }
  override async run(s: Sys, av: string[]): Promise<number> {
    const a = [...av], f = a[0]?.startsWith("-") ? a.shift()!.slice(1) : "d";
    if (!a.length) bad("EINVAL", `${this.name}: no input files`);
    for (const p of a) {
      const x = this.bin(s, p); await s.out(`\n${p}: ${x.machine} ${x.kind === "obj" ? "relocatable object" : "executable"}\n`);
      if (f.includes("h")) for (const q of x.sec) await s.out(`${q.name.padEnd(16)} ${q.flg.padEnd(3)} addr ${hex(q.addr)} off 00000000 size ${hex(q.size)} align ${q.align}\n`);
      if (f.includes("d")) for (const q of x.sec.filter(v => v.flg.includes("x"))) await this.dis(s, x, q);
      if (f.includes("r") && x instanceof Obj) for (const r of x.rel) await s.out(`${r.sec}+0x${hex(r.off)} ${r.type.padEnd(6)} ${r.sym}${r.add ? r.add > 0 ? `+${r.add}` : r.add : ""}\n`);
    }
    return 0;
  }

  private async dis(s: Sys, x: Bin, q: Sec): Promise<void> {
    await s.out(`\nDisassembly of section ${q.name}:\n`);
    const sy = x.sym.filter(v => v.sec === q.name).sort((a, b) => a.val - b.val), rel = x instanceof Obj ? x.rel.filter(v => v.sec === q.name) : [];
    const iz = x.machine === "thistle64" ? I64_SZ : I_SZ;
    for (let at = 0; at + iz <= q.data.length; at += iz) {
      const pc = x instanceof Exe ? q.addr + at : at;
      for (const z of sy.filter(v => (x instanceof Exe ? v.val - q.addr : v.val) === at)) await s.out(`\n${hex(pc)} <${z.name}>:\n`);
      const b = q.data.slice(at, at + iz), r = rel.find(v => v.off >= at && v.off < at + iz);
      const ins = x.machine === "thistle64" ? text64(decode64(q.data, at), BigInt(pc)) : text(decode(q.data, at), pc);
      await s.out(` ${hex(pc)}: ${[...b].map(v => v.toString(16).padStart(2, "0")).join(" ")}  ${ins}${r ? ` ; ${r.type} ${r.sym}${this.add(r)}` : ""}\n`);
    }
    if (q.data.length % iz) await s.out(` ${hex((x instanceof Exe ? q.addr : 0) + q.data.length - q.data.length % iz)}: <trailing data>\n`);
  }

  private add(r: Rel): string { return r.add ? r.add > 0 ? `+${r.add}` : String(r.add) : ""; }
}

export class ObjdumpApp extends DisApp { constructor() { super("objdump"); } }

export class NmApp extends ToolApp {
  constructor() { super("nm", "List symbols in Thistle objects and executables.", "nm [-gun] file ..."); }
  override async run(s: Sys, av: string[]): Promise<number> {
    const a = [...av], fl = a[0]?.startsWith("-") ? a.shift()!.slice(1) : "";
    for (const p of a) {
      if (a.length > 1) await s.out(`\n${p}:\n`);
      let q = this.bin(s, p).sym.filter(x => !fl.includes("g") || x.bind !== "local").filter(x => !fl.includes("u") || !x.sec);
      q = q.sort(fl.includes("n") ? (a, b) => a.val - b.val || a.name.localeCompare(b.name) : (a, b) => a.name.localeCompare(b.name));
      for (const x of q) await s.out(`${x.sec ? hex(x.val) : "        "} ${this.kind(x)} ${x.name}\n`);
    }
    return a.length ? 0 : 1;
  }

  private kind(x: Sym): string {
    if (!x.sec) return x.bind === "weak" ? "w" : "U";
    if (x.bind === "weak") return "W";
    const c = x.sec === "ABS" ? "A" : x.sec.includes("text") ? "T" : x.sec.includes("bss") ? "B" : x.sec.includes("rodata") ? "R" : "D";
    return x.bind === "local" ? c.toLowerCase() : c;
  }
}

export class SizeApp extends ToolApp {
  constructor() { super("size", "Show section sizes in Thistle binaries.", "size file ..."); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length) return 1; await s.out("   text    data     bss     dec     hex filename\n");
    for (const p of a) {
      const x = this.bin(s, p), text = x.sec.filter(q => !q.flg.includes("w")).reduce((n, q) => n + q.size, 0), data = x.sec.filter(q => q.flg.includes("w") && q.data.length).reduce((n, q) => n + q.data.length, 0), bss = x.sec.reduce((n, q) => n + q.size - q.data.length, 0), n = text + data + bss;
      await s.out(`${String(text).padStart(7)} ${String(data).padStart(7)} ${String(bss).padStart(7)} ${String(n).padStart(7)} ${n.toString(16).padStart(7)} ${p}\n`);
    }
    return 0;
  }
}
