import { bad } from "../core/err.js";

export const esc = (s: string): string => s.replace(/\\([\\abefnrtv0])/g, (_m, c: string) => ({
  "\\": "\\", a: "\x07", b: "\b", e: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "0": "\0",
}[c] ?? c));

export const narg = (s: string, what = "number"): number => {
  const n = Number(s);
  if (!Number.isFinite(n)) bad("EINVAL", `${what}: ${s}`);
  return n;
};

export const size = (n: number): string => {
  const u = ["B", "K", "M", "G", "T"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i ? n.toFixed(1) : Math.round(n)}${u[i]}`;
};

export const globRx = (s: string): RegExp => new RegExp("^" + s
  .replace(/[.+^${}()|\\]/g, "\\$&")
  .replace(/\*/g, ".*")
  .replace(/\?/g, ".") + "$");

export const cols = (a: string[], gap = 2): string => {
  if (!a.length) return "";
  const w = Math.max(...a.map(x => x.length)) + gap;
  const n = Math.max(1, Math.floor(80 / w));
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i]!.padEnd((i + 1) % n && i < a.length - 1 ? w : 0) + ((i + 1) % n ? "" : "\n");
  return s.endsWith("\n") ? s : s + "\n";
};
