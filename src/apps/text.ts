import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
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
  if ((a.at(-1) ?? null) === "") a.pop();
  return a;
};

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Echo extends App {
  constructor() { super("echo", "Print arguments.", "echo [-ne] [arg ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    let nl = true, e = false;
    while ((a[0] ?? null) === "-n" || (a[0] ?? null) === "-e" || (a[0] ?? null) === "-ne" || (a[0] ?? null) === "-en") { const x = requireValue(a.shift() ?? null, "src/apps/text.ts:23"); nl &&= !x.includes("n"); e ||= x.includes("e"); }
    const x = a.join(" ");
    await s.out((e ? esc(x) : x) + (nl ? "\n" : ""));
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Printf extends App {
  constructor() { super("printf", "Format and print values.", "printf format [value ...]"); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length) bad("EINVAL", "printf: missing format");
    let i = 1;
    const f = esc(requireValue(a[0] ?? null, "src/apps/text.ts:35"));
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

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Tail extends App {
  constructor() { super("tail", "Print the final lines of input.", "tail [-n count] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    let n = 10;
    switch (true) {
case !!((a[0] ?? null) === "-n"): {  n = narg(a[1] ?? "", "line count"); a.splice(0, 2);
break; }
case !!(/^-\d+$/.test(a[0] ?? "")): { n = Number(requireValue(a.shift() ?? null, "src/apps/text.ts:55").slice(1));
break; }
}
    for (const [, x] of await src(s, a)) { const q = lines(x).slice(-n); if (q.length) await s.out(q.join("\n") + "\n"); }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Wc extends App {
  constructor() { super("wc", "Count lines, words and bytes.", "wc [-lwc] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a.filter(x => /^-[lwc]+$/.test(x)).join("");
    a = a.filter(x => !/^-[lwc]+$/.test(x));
    const q = await src(s, a);
    for (const [p, x] of q) {
      const v = [lines(x).length, (x.match(/\S+/g) ?? []).length, enc(x).length];
      const z = f ? [f.includes("l") ? (v[0] ?? null) : null, f.includes("w") ? (v[1] ?? null) : null, f.includes("c") ? (v[2] ?? null) : null].filter(n => n !== null) : v;
      await s.out(z.map(n => String(n).padStart(7)).join("") + (p === "-" ? "" : ` ${p}`) + "\n");
    }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Grep extends App {
  constructor() { super("grep", "Select lines matching a pattern.", "grep [-ivncE] pattern [file ...]"); }
  // App.run is the required polymorphic command entry point, including stateless commands.
  //@cg-expect-warning
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = (withValue((a[0] ?? null) ?? null, value => value.startsWith("-")) ?? null) ? requireValue(a.shift() ?? null, "src/apps/text.ts:79") : "";
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

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Sort extends App {
  constructor() { super("sort", "Sort text lines.", "sort [-nru] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = a.filter(x => /^-[nru]+$/.test(x)).join("");
    a = a.filter(x => !/^-[nru]+$/.test(x));
    let q = (await src(s, a)).flatMap(([, x]) => lines(x));
    q.sort(f.includes("n") ? (a0, b0) => Number(a0) - Number(b0) : (a0, b0) => a0.localeCompare(b0));
    if (f.includes("u")) q = q.filter((x, i) => !i || x !== (q[i - 1] ?? null));
    if (f.includes("r")) q.reverse();
    if (q.length) await s.out(q.join("\n") + "\n");
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Uniq extends App {
  constructor() { super("uniq", "Filter adjacent duplicate lines.", "uniq [-cd] [file]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const f = (withValue((a[0] ?? null) ?? null, value => value.startsWith("-")) ?? null) ? requireValue(a.shift() ?? null, "src/apps/text.ts:117") : "";
    const q = lines(withValue(((await src(s, a))[0] ?? null) ?? null, value => value[1]) ?? "");
    for (let i = 0; i < q.length;) {
      let j = i + 1; while (j < q.length && (q[j] ?? null) === (q[i] ?? null)) j++;
      if (!f.includes("d") || j - i > 1) await s.out(`${f.includes("c") ? String(j - i).padStart(7) + " " : ""}${(q[i] ?? null)}\n`);
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
    const a = Number((m[1] ?? null)), b = (m[2] ?? null) === null ? a : (m[2] ?? null) === "" ? 1e9 : Number((m[2] ?? null));
    for (let i = a; i <= b && i < 1e6; i++) out.push(i);
  }
  return out;
};

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Cut extends App {
  constructor() { super("cut", "Select fields or characters.", "cut -d delim -f list | -c list [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const fi = a.indexOf("-f"), ci = a.indexOf("-c"), di = a.indexOf("-d");
    const spec = (fi >= 0 ? (a[fi + 1] ?? null) : ci >= 0 ? (a[ci + 1] ?? null) : null) ?? bad("EINVAL", "cut: -f or -c required");
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
  let x = ""; for (let i = requireValue(a.codePointAt(0) ?? null, "src/apps/text.ts:157"); i <= requireValue(b.codePointAt(0) ?? null, "src/apps/text.ts:157"); i++) x += String.fromCodePoint(i); return x;
});

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Tr extends App {
  constructor() { super("tr", "Translate or delete characters.", "tr [-d] set1 [set2]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const del = (a[0] ?? null) === "-d"; if (del) a.shift();
    if (!(a[0] ?? null) || (!del && (a[1] ?? null) === null)) bad("EINVAL", "tr arguments");
    const x = set(esc(requireValue(a[0] ?? null, "src/apps/text.ts:165"))), y = set(esc(a[1] ?? ""));
    let out = "";
    for (const c of await s.input()) { const i = x.indexOf(c); switch (true) {
case !!(i < 0): { out += c;
break; }
case !!(!del): { out += y[Math.min(i, y.length - 1)] ?? "";
break; }
} }
    await s.out(out); return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Sed extends App {
  constructor() { super("sed", "Apply a substitution to text.", "sed [-n] 's/pattern/replacement/[gp]' [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const quiet = (a[0] ?? null) === "-n"; if (quiet) a.shift();
    const ex = (a.shift() ?? null); if (ex === null || !ex.startsWith("s")) return bad("EINVAL", "sed: substitution required");
    const d = (ex[1] ?? null); if (!d) return bad("EINVAL", "sed expression");
    const p = ex.slice(2).split(d); if (p.length < 3) bad("EINVAL", "sed expression");
    let rx: RegExp = /(?:)/; try { rx = new RegExp(requireValue(p[0] ?? null, "src/apps/text.ts:179"), (withValue((p[2] ?? null) ?? null, value => value.includes("g")) ?? null) ? "g" : ""); } catch { return bad("EINVAL", "sed pattern"); }
    for (const [, x] of await src(s, a)) for (const line of lines(x)) {
      const hit = rx.test(line); rx.lastIndex = 0;
      const z = line.replace(rx, requireValue(p[1] ?? null, "src/apps/text.ts:182").replace(/&/g, "$&"));
      if (!quiet || (hit && (withValue((p[2] ?? null) ?? null, value => value.includes("p")) ?? null))) await s.out(z + "\n");
    }
    return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Tee extends App {
  constructor() { super("tee", "Copy standard input to files and output.", "tee [-a] [file ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const add = (a[0] ?? null) === "-a"; if (add) a.shift();
    const b = await s.inb();
    for (const p of a) s.writeb(p, b, add);
    await s.out(b); return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Seq extends App {
  constructor() { super("seq", "Print a numeric sequence.", "seq [first [step]] last"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length || a.length > 3) bad("EINVAL", "seq arguments");
    const first = a.length === 1 ? 1 : narg(requireValue(a[0] ?? null, "src/apps/text.ts:203")), step = a.length === 3 ? narg(requireValue(a[1] ?? null, "src/apps/text.ts:203")) : 1, last = narg(requireValue(a.at(-1) ?? null, "src/apps/text.ts:203"));
    if (!step) bad("EINVAL", "zero step");
    let out = "";
    for (let n = first, i = 0; step > 0 ? n <= last : n >= last; n += step) { out += `${n}\n`; if (++i > 1_000_000) bad("ERANGE", "sequence too large"); }
    await s.out(out); return 0;
  }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
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
  let out = ""; for (let i = 0; i < b.length; i += 3) { const n = (requireValue(b[i] ?? null, "src/apps/text.ts:223") << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0); out += requireValue(abc[(n >> 18) & 63] ?? null, "src/apps/text.ts:223") + requireValue(abc[(n >> 12) & 63] ?? null, "src/apps/text.ts:223") + (i + 1 < b.length ? requireValue(abc[(n >> 6) & 63] ?? null, "src/apps/text.ts:223") : "=") + (i + 2 < b.length ? requireValue(abc[n & 63] ?? null, "src/apps/text.ts:223") : "="); } return out;
};

const b64d = (x: string): Uint8Array => {
  x = x.replace(/\s/g, "");
  if (typeof atob === "function") return Uint8Array.from(atob(x), c => c.charCodeAt(0));
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; const out: number[] = [];
  for (let i = 0; i < x.length; i += 4) { const n = (abc.indexOf(requireValue(x[i] ?? null, "src/apps/text.ts:230")) << 18) | (abc.indexOf(requireValue(x[i + 1] ?? null, "src/apps/text.ts:230")) << 12) | ((abc.indexOf(requireValue(x[i + 2] ?? null, "src/apps/text.ts:230")) & 63) << 6) | (abc.indexOf(requireValue(x[i + 3] ?? null, "src/apps/text.ts:230")) & 63); out.push((n >> 16) & 255); if ((x[i + 2] ?? null) !== "=") out.push((n >> 8) & 255); if ((x[i + 3] ?? null) !== "=") out.push(n & 255); } return new Uint8Array(out);
};

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Base64 extends App {
  constructor() { super("base64", "Encode or decode base64 data.", "base64 [-d] [file]"); }
  override async run(s: Sys, a: string[]): Promise<number> { const d = (a[0] ?? null) === "-d"; if (d) a.shift(); const b = (a[0] ?? null) ? s.readb((requireValue(a[0] ?? null, "src/apps/text.ts:237") ?? null)) : await s.inb(); await s.out(d ? b64d(dec(b)) : b64e(b) + "\n"); return 0; }
}

// Distinct commands deliberately implement the shared App contract.
//@cg-expect-warning
export class Strings extends App {
  constructor() { super("strings", "Print readable strings in binary data.", "strings [-n length] file ..."); }
  override async run(s: Sys, a: string[]): Promise<number> { let n = 4; if ((a[0] ?? null) === "-n") { n = narg(a[1] ?? ""); a.splice(0, 2); } for (const p of a) { const x = dec(s.readb(p)); for (const m of x.matchAll(/[\x20-\x7e]+/g)) if (m[0].length >= n) await s.out(m[0] + "\n"); } return 0; }
}
