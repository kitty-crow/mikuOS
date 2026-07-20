import { App } from "./base.js";
import type { Sys } from "../core/sys.js";
import { bad } from "../core/err.js";
import { esc, narg } from "./util.js";
import { dec, enc } from "../io/stream.js";

const src = async (s: Sys, a: string[]): Promise<Array<[string, string]>> => {
  const ps = a.filter(x => x !== "-");
  if (!a.length || a.includes("-")) return [["-", await s.input()], ...ps.map(p => [p, s.read(p)] as [string, string])];
  return ps.map(p => [p, s.read(p)]);
};

const lines = (x: string): string[] => {
  const a = x.split("\n");
  if (a.at(-1) === "") a.pop();
  return a;
};

export class Echo extends App {
  constructor() { super("echo", "Print arguments.", "echo [-ne] [arg ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    let nl = true, e = false;
    while (a[0] === "-n" || a[0] === "-e" || a[0] === "-ne" || a[0] === "-en") { const x = a.shift()!; nl &&= !x.includes("n"); e ||= x.includes("e"); }
    const x = a.join(" ");
    await s.out((e ? esc(x) : x) + (nl ? "\n" : ""));
    return 0;
  }
}

export class Printf extends App {
  constructor() { super("printf", "Format and print values.", "printf format [value ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length) bad("EINVAL", "printf: missing format");
    let i = 1;
    const f = esc(a[0]!);
    const out = f.replace(/%([%sdixXoc])/g, (_m, k: string) => {
      if (k === "%") return "%";
      const v = a[i++] ?? "";
      if (k === "s") return v;
      if (k === "c") return v[0] ?? "";
      const n = Number.parseInt(v, 0);
      if (!Number.isFinite(n)) return "0";
      return k === "x" ? n.toString(16) : k === "X" ? n.toString(16).toUpperCase() : k === "o" ? n.toString(8) : String(n);
    });
    await s.out(out);
    return 0;
  }
}

export class Head extends App {
  constructor() { super("head", "Print the first lines of input.", "head [-n count] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    let n = 10;
    if (a[0] === "-n") { n = narg(a[1] ?? "", "line count"); a.splice(0, 2); }
    else if (/^-\d+$/.test(a[0] ?? "")) n = Number(a.shift()!.slice(1));
    if (a.length) for (const [, x] of await src(s, a)) await s.out(lines(x).slice(0, n).join("\n") + (n && x ? "\n" : ""));
    else {
      let q = "";
      while (lines(q).length < n) { const b = await s.chunk(); if (!b) break; q += b; }
      const z = lines(q).slice(0, n);
      if (z.length) await s.out(z.join("\n") + "\n");
    }
    return 0;
  }
}

export class Tail extends App {
  constructor() { super("tail", "Print the final lines of input.", "tail [-n count] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    let n = 10;
    if (a[0] === "-n") { n = narg(a[1] ?? "", "line count"); a.splice(0, 2); }
    else if (/^-\d+$/.test(a[0] ?? "")) n = Number(a.shift()!.slice(1));
    for (const [, x] of await src(s, a)) { const q = lines(x).slice(-n); if (q.length) await s.out(q.join("\n") + "\n"); }
    return 0;
  }
}

export class Wc extends App {
  constructor() { super("wc", "Count lines, words and bytes.", "wc [-lwc] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a.filter(x => /^-[lwc]+$/.test(x)).join("");
    a = a.filter(x => !/^-[lwc]+$/.test(x));
    const q = await src(s, a);
    for (const [p, x] of q) {
      const v = [lines(x).length, (x.match(/\S+/g) ?? []).length, enc(x).length];
      const z = f ? [f.includes("l") ? v[0] : undefined, f.includes("w") ? v[1] : undefined, f.includes("c") ? v[2] : undefined].filter(n => n !== undefined) : v;
      await s.out(z.map(n => String(n).padStart(7)).join("") + (p === "-" ? "" : ` ${p}`) + "\n");
    }
    return 0;
  }
}

export class Grep extends App {
  constructor() { super("grep", "Select lines matching a pattern.", "grep [-ivncE] pattern [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a[0]?.startsWith("-") ? a.shift()! : "";
    const pat = a.shift() ?? bad("EINVAL", "grep: missing pattern");
    let rx: RegExp = /(?:)/;
    try { rx = new RegExp(f.includes("E") ? pat : pat.replace(/[+?(){}|]/g, "\\$&"), f.includes("i") ? "i" : ""); }
    catch { bad("EINVAL", `bad pattern: ${pat}`); }
    let hit = 0;
    const q = await src(s, a);
    for (const [p, x] of q) {
      let n = 0;
      for (const [i, line] of lines(x).entries()) {
        const yes = rx.test(line) !== f.includes("v");
        if (!yes) continue;
        hit++; n++;
        if (!f.includes("c")) await s.out(`${q.length > 1 ? `${p}:` : ""}${f.includes("n") ? `${i + 1}:` : ""}${line}\n`);
      }
      if (f.includes("c")) await s.out(`${q.length > 1 ? `${p}:` : ""}${n}\n`);
    }
    return hit ? 0 : 1;
  }
}

export class Sort extends App {
  constructor() { super("sort", "Sort text lines.", "sort [-nru] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a.filter(x => /^-[nru]+$/.test(x)).join("");
    a = a.filter(x => !/^-[nru]+$/.test(x));
    let q = (await src(s, a)).flatMap(([, x]) => lines(x));
    q.sort(f.includes("n") ? (a0, b0) => Number(a0) - Number(b0) : (a0, b0) => a0.localeCompare(b0));
    if (f.includes("u")) q = q.filter((x, i) => !i || x !== q[i - 1]);
    if (f.includes("r")) q.reverse();
    if (q.length) await s.out(q.join("\n") + "\n");
    return 0;
  }
}

export class Uniq extends App {
  constructor() { super("uniq", "Filter adjacent duplicate lines.", "uniq [-cd] [file]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a[0]?.startsWith("-") ? a.shift()! : "";
    const q = lines((await src(s, a))[0]?.[1] ?? "");
    for (let i = 0; i < q.length;) {
      let j = i + 1; while (j < q.length && q[j] === q[i]) j++;
      if (!f.includes("d") || j - i > 1) await s.out(`${f.includes("c") ? String(j - i).padStart(7) + " " : ""}${q[i]}\n`);
      i = j;
    }
    return 0;
  }
}

const range = (x: string): number[] => {
  const out: number[] = [];
  for (const p of x.split(",")) {
    const m = /^(\d+)(?:-(\d*))?$/.exec(p);
    if (!m) return bad("EINVAL", `range ${x}`);
    const a = Number(m[1]), b = m[2] === undefined ? a : m[2] === "" ? 1e9 : Number(m[2]);
    for (let i = a; i <= b && i < 1e6; i++) out.push(i);
  }
  return out;
};

export class Cut extends App {
  constructor() { super("cut", "Select fields or characters.", "cut -d delim -f list | -c list [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const fi = a.indexOf("-f"), ci = a.indexOf("-c"), di = a.indexOf("-d");
    const spec = (fi >= 0 ? a[fi + 1] : ci >= 0 ? a[ci + 1] : undefined) ?? bad("EINVAL", "cut: -f or -c required");
    const take = new Set(range(spec));
    const skip = new Set([fi, fi + 1, ci, ci + 1, di, di + 1]);
    const ps = a.filter((_x, i) => !skip.has(i));
    const d = di >= 0 ? a[di + 1] ?? "\t" : "\t";
    for (const [, x] of await src(s, ps)) for (const line of lines(x)) {
      const q = fi >= 0 ? line.split(d) : [...line];
      await s.out(q.filter((_v, i) => take.has(i + 1)).join(fi >= 0 ? d : "") + "\n");
    }
    return 0;
  }
}

const set = (s: string): string => s.replace(/(.)-(.)/g, (_m, a: string, b: string) => {
  let x = ""; for (let i = a.codePointAt(0)!; i <= b.codePointAt(0)!; i++) x += String.fromCodePoint(i); return x;
});

export class Tr extends App {
  constructor() { super("tr", "Translate or delete characters.", "tr [-d] set1 [set2]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const del = a[0] === "-d"; if (del) a.shift();
    if (!a[0] || (!del && a[1] === undefined)) bad("EINVAL", "tr arguments");
    const x = set(esc(a[0]!)), y = set(esc(a[1] ?? ""));
    let out = "";
    for (const c of await s.input()) { const i = x.indexOf(c); if (i < 0) out += c; else if (!del) out += y[Math.min(i, y.length - 1)] ?? ""; }
    await s.out(out); return 0;
  }
}

export class Sed extends App {
  constructor() { super("sed", "Apply a substitution to text.", "sed [-n] 's/pattern/replacement/[gp]' [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const quiet = a[0] === "-n"; if (quiet) a.shift();
    const ex = a.shift(); if (!ex?.startsWith("s")) return bad("EINVAL", "sed: substitution required");
    const d = ex[1]; if (!d) return bad("EINVAL", "sed expression");
    const p = ex.slice(2).split(d); if (p.length < 3) bad("EINVAL", "sed expression");
    let rx: RegExp = /(?:)/; try { rx = new RegExp(p[0]!, p[2]?.includes("g") ? "g" : ""); } catch { return bad("EINVAL", "sed pattern"); }
    for (const [, x] of await src(s, a)) for (const line of lines(x)) {
      const hit = rx.test(line); rx.lastIndex = 0;
      const z = line.replace(rx, p[1]!.replace(/&/g, "$&"));
      if (!quiet || (hit && p[2]?.includes("p"))) await s.out(z + "\n");
    }
    return 0;
  }
}

export class Tee extends App {
  constructor() { super("tee", "Copy standard input to files and output.", "tee [-a] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const add = a[0] === "-a"; if (add) a.shift();
    const b = await s.inb();
    for (const p of a) s.writeb(p, b, add);
    await s.out(b); return 0;
  }
}

export class Seq extends App {
  constructor() { super("seq", "Print a numeric sequence.", "seq [first [step]] last"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length || a.length > 3) bad("EINVAL", "seq arguments");
    const first = a.length === 1 ? 1 : narg(a[0]!), step = a.length === 3 ? narg(a[1]!) : 1, last = narg(a.at(-1)!);
    if (!step) bad("EINVAL", "zero step");
    let out = "";
    for (let n = first, i = 0; step > 0 ? n <= last : n >= last; n += step) { out += `${n}\n`; if (++i > 1_000_000) bad("ERANGE", "sequence too large"); }
    await s.out(out); return 0;
  }
}

export class Yes extends App {
  constructor() { super("yes", "Repeat a line until interrupted.", "yes [text]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const x = (a.length ? a.join(" ") : "y") + "\n";
    for (let i = 0;; i++) { s.chk(); await s.out(x); if (!(i & 255)) await s.sleep(0); }
  }
}

const b64e = (b: Uint8Array): string => {
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  if (typeof btoa === "function") return btoa(s);
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = ""; for (let i = 0; i < b.length; i += 3) { const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0); out += abc[(n >> 18) & 63]! + abc[(n >> 12) & 63]! + (i + 1 < b.length ? abc[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? abc[n & 63]! : "="); } return out;
};

const b64d = (x: string): Uint8Array => {
  x = x.replace(/\s/g, "");
  if (typeof atob === "function") return Uint8Array.from(atob(x), c => c.charCodeAt(0));
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; const out: number[] = [];
  for (let i = 0; i < x.length; i += 4) { const n = (abc.indexOf(x[i]!) << 18) | (abc.indexOf(x[i + 1]!) << 12) | ((abc.indexOf(x[i + 2]!) & 63) << 6) | (abc.indexOf(x[i + 3]!) & 63); out.push((n >> 16) & 255); if (x[i + 2] !== "=") out.push((n >> 8) & 255); if (x[i + 3] !== "=") out.push(n & 255); } return new Uint8Array(out);
};

export class Base64 extends App {
  constructor() { super("base64", "Encode or decode base64 data.", "base64 [-d] [file]"); }
  override async run(s: Sys, a: string[]): Promise<number> { const d = a[0] === "-d"; if (d) a.shift(); const b = a[0] ? s.readb(a[0]) : await s.inb(); await s.out(d ? b64d(dec(b)) : b64e(b) + "\n"); return 0; }
}

export class Strings extends App {
  constructor() { super("strings", "Print readable strings in binary data.", "strings [-n length] file ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { let n = 4; if (a[0] === "-n") { n = narg(a[1] ?? ""); a.splice(0, 2); } for (const p of a) { const x = dec(s.readb(p)); for (const m of x.matchAll(/[\x20-\x7e]+/g)) if (m[0].length >= n) await s.out(m[0] + "\n"); } return 0; }
}
