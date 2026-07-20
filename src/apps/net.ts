import { App } from "./base.js";
import type { Sys } from "../core/sys.js";
import { KErr, bad, msg } from "../core/err.js";
import type { Hdr } from "../net/net.js";
import { enc } from "../io/stream.js";
import { size } from "./util.js";

interface WOpt {
  out?: string;
  quiet: boolean;
  server: boolean;
  spider: boolean;
  nc: boolean;
  timeout: number;
  redirs: number;
  max: number;
  method: string;
  hdr: Hdr;
  body?: Uint8Array;
  urls: string[];
}

const take = (a: string[], i: number, name: string): string => a[i + 1] ?? bad("EINVAL", `${name}: missing value`);

const num = (s: string, name: string): number => {
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) bad("EINVAL", `${name}: ${s}`);
  return n;
};

const fname = (raw: string): string => {
  const u = new URL(raw);
  const p = u.pathname.split("/").filter(Boolean).at(-1) ?? "index.html";
  try { return decodeURIComponent(p) || "index.html"; } catch { return p; }
};

const exists = (s: Sys, p: string): boolean => {
  try { s.stat(p); return true; } catch { return false; }
};

export class Wget extends App {
  constructor() {
    super("wget", "Retrieve files over HTTP or HTTPS.", "wget [-qS] [--spider] [-O file] [-T sec] [--max-size bytes] URL ...");
  }

  override async run(s: Sys, a: string[]): Promise<number> {
    const o = this.parse(a);
    if (!o.urls.length) bad("EINVAL", "wget: missing URL");
    if (o.out !== undefined && o.urls.length > 1) bad("EINVAL", "wget: -O accepts one URL");
    let code = 0;
    for (const url of o.urls) {
      const path = o.out ?? fname(url);
      if (!o.spider && path !== "-" && o.nc && exists(s, path)) { await s.err(`${path}: EEXIST: file exists\n`); code = 1; continue; }
      try {
        if (!o.quiet) await s.err(`${o.spider ? "Spider" : "Request"}: ${url}\n`);
        const q = { url, method: o.spider ? "HEAD" : o.method, hdr: o.hdr, redirs: o.redirs, timeout: o.timeout, max: o.max };
        const r = await s.net(o.body === undefined ? q : { ...q, body: o.body });
        if (o.server) {
          await s.err(`  HTTP ${r.status} ${r.text}\n`);
          for (const [k, v] of Object.entries(r.hdr)) await s.err(`  ${k}: ${v}\n`);
        }
        if (r.status < 200 || r.status >= 400) { await s.err(`${url}: server returned ${r.status} ${r.text}\n`); code = 8; continue; }
        if (o.spider) { if (!o.quiet) await s.err(`Remote file exists (${r.status}).\n`); continue; }
        if (path === "-") await s.out(r.body);
        else s.writeb(path, r.body);
        if (!o.quiet) await s.err(`${path === "-" ? "stdout" : path} saved [${size(r.body.length)}]\n`);
      } catch (e) {
        await s.err(`wget: ${msg(e)}\n`);
        code = e instanceof KErr && ["EACCES", "EEXIST", "ENOSPC", "EROFS"].includes(e.code) ? 3 : 4;
      }
    }
    return code;
  }

  private parse(a: string[]): WOpt {
    const o: WOpt = {
      quiet: false, server: false, spider: false, nc: false,
      timeout: 30_000, redirs: 10, max: 12 * 1024 * 1024,
      method: "GET", hdr: {}, urls: [],
    };
    let end = false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i]!;
      if (end || !x.startsWith("-") || x === "-") { o.urls.push(x); continue; }
      if (x === "--") { end = true; continue; }
      if (x === "-q" || x === "--quiet") o.quiet = true;
      else if (x === "-S" || x === "--server-response") o.server = true;
      else if (x.startsWith("-qO") && x.length > 3) { o.quiet = true; o.out = x.slice(3); }
      else if (/^-[qS]+$/.test(x)) { o.quiet ||= x.includes("q"); o.server ||= x.includes("S"); }
      else if (x === "--spider") o.spider = true;
      else if (x === "-nc" || x === "--no-clobber") o.nc = true;
      else if (x === "-O" || x === "--output-document") o.out = take(a, i++, x);
      else if (x.startsWith("-O") && x.length > 2) o.out = x.slice(2);
      else if (x.startsWith("--output-document=")) o.out = x.slice(18);
      else if (x === "-T" || x === "--timeout") o.timeout = num(take(a, i++, x), x) * 1000;
      else if (x.startsWith("-T") && x.length > 2) o.timeout = num(x.slice(2), "-T") * 1000;
      else if (x.startsWith("--timeout=")) o.timeout = num(x.slice(10), "--timeout") * 1000;
      else if (x === "--max-redirect") o.redirs = num(take(a, i++, x), x);
      else if (x.startsWith("--max-redirect=")) o.redirs = num(x.slice(15), "--max-redirect");
      else if (x === "--max-size") o.max = num(take(a, i++, x), x);
      else if (x.startsWith("--max-size=")) o.max = num(x.slice(11), "--max-size");
      else if (x === "--method") o.method = take(a, i++, x).toUpperCase();
      else if (x.startsWith("--method=")) o.method = x.slice(9).toUpperCase();
      else if (x === "--header") this.header(o, take(a, i++, x));
      else if (x.startsWith("--header=")) this.header(o, x.slice(9));
      else if (x === "--user-agent") o.hdr["user-agent"] = take(a, i++, x);
      else if (x.startsWith("--user-agent=")) o.hdr["user-agent"] = x.slice(13);
      else if (x === "--post-data") { o.body = enc(take(a, i++, x)); o.method = "POST"; }
      else if (x.startsWith("--post-data=")) { o.body = enc(x.slice(12)); o.method = "POST"; }
      else bad("EINVAL", `wget: unknown option ${x}`);
    }
    o.redirs = Math.floor(o.redirs);
    o.max = Math.floor(o.max);
    return o;
  }

  private header(o: WOpt, x: string): void {
    const at = x.indexOf(":");
    if (at < 1) bad("EINVAL", `wget: bad header ${x}`);
    o.hdr[x.slice(0, at).trim().toLowerCase()] = x.slice(at + 1).trim();
  }
}
