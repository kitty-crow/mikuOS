import { KErr, bad } from "../core/err.js";

export type Hdr = Record<string, string>;

export interface NReq {
  url: string;
  method?: string;
  hdr?: Hdr;
  body?: Uint8Array;
  redirs?: number;
  timeout?: number;
  max?: number;
}

export interface NRes {
  url: string;
  status: number;
  text: string;
  hdr: Hdr;
  body: Uint8Array;
  hops: string[];
}

export interface DReq {
  url: string;
  method: string;
  hdr: Hdr;
  body?: Uint8Array;
  max: number;
}

export interface DRes {
  url: string;
  status: number;
  text: string;
  hdr: Hdr;
  body: Uint8Array;
}

const hdrs = (h: Headers): Hdr => {
  const out: Hdr = {};
  h.forEach((v, k) => { out[k.toLowerCase()] = v; });
  return out;
};

const bytes = async (r: Response, max: number): Promise<Uint8Array> => {
  if (!r.body) return new Uint8Array();
  const q: Uint8Array[] = [];
  const rd = r.body.getReader();
  let n = 0;
  try {
    for (;;) {
      const x = await rd.read();
      if (x.done) break;
      n += x.value.length;
      if (n > max) throw new KErr("EFBIG", `response exceeds ${max} bytes`);
      q.push(x.value);
    }
  } finally { rd.releaseLock(); }
  const b = new Uint8Array(n);
  let at = 0;
  for (const x of q) { b.set(x, at); at += x.length; }
  return b;
};

/** A network device moves one HTTP exchange. Policy lives in Net. */
export abstract class NetDev {
  abstract req(r: DReq, sig: AbortSignal): Promise<DRes>;
}

export class FetchDev extends NetDev {
  override async req(r: DReq, sig: AbortSignal): Promise<DRes> {
    const init: RequestInit = { method: r.method, headers: r.hdr, redirect: "manual", signal: sig };
    if (r.body && r.method !== "GET" && r.method !== "HEAD") init.body = Uint8Array.from(r.body);
    let x: Response;
    try { x = await fetch(r.url, init); }
    catch (e) { throw this.fail(e); }
    return { url: x.url || r.url, status: x.status, text: x.statusText, hdr: hdrs(x.headers), body: await bytes(x, r.max) };
  }

  private fail(e: unknown): KErr {
    if (e instanceof KErr) return e;
    if (e instanceof DOMException && e.name === "AbortError") return new KErr("EINTR", "network request interrupted");
    return new KErr("ENETUNREACH", e instanceof Error ? e.message : String(e));
  }
}

const moved = new Set([301, 302, 303, 307, 308]);

export class Net {
  rx = 0;
  tx = 0;
  calls = 0;
  fails = 0;
  log: (s: string) => void = () => {};

  constructor(readonly dev: NetDev = new FetchDev()) {}

  async req(r: NReq, parent?: AbortSignal): Promise<NRes> {
    const method = (r.method ?? "GET").toUpperCase();
    if (!/^[A-Z]+$/.test(method)) bad("EINVAL", `bad HTTP method: ${method}`);
    const max = r.max ?? 12 * 1024 * 1024;
    const redirs = r.redirs ?? 10;
    const timeout = r.timeout ?? 30_000;
    if (!Number.isInteger(max) || max < 0 || !Number.isInteger(redirs) || redirs < 0 || !Number.isFinite(timeout) || timeout <= 0) bad("EINVAL", "bad network limit");

    const ac = new AbortController();
    const stop = (): void => ac.abort(parent?.reason);
    parent?.addEventListener("abort", stop, { once: true });
    const id = setTimeout(() => ac.abort(new KErr("ETIMEDOUT", r.url)), timeout);
    let url = this.url(r.url);
    let verb = method;
    let body = r.body;
    const hops: string[] = [];
    try {
      for (let n = 0;; n++) {
        this.calls++;
        this.tx += body?.length ?? 0;
        this.log(`net: ${verb} ${url}`);
        const q: DReq = { url, method: verb, hdr: { "user-agent": "Thistle/2.1.0", ...(r.hdr ?? {}) }, max };
        if (body !== undefined) q.body = body;
        const x = await this.dev.req(q, ac.signal);
        this.rx += x.body.length;
        if (!moved.has(x.status) || !x.hdr.location) return { ...x, hops };
        if (n >= redirs) bad("ELOOP", `too many redirects: ${r.url}`);
        hops.push(url);
        url = this.url(new URL(x.hdr.location, url).href);
        if (x.status === 303 || ((x.status === 301 || x.status === 302) && verb === "POST")) { verb = "GET"; body = undefined; }
      }
    } catch (e) {
      this.fails++;
      if (ac.signal.aborted) {
        if (parent?.aborted) throw new KErr("EINTR", "network request interrupted");
        throw new KErr("ETIMEDOUT", r.url);
      }
      throw e;
    } finally {
      clearTimeout(id);
      parent?.removeEventListener("abort", stop);
    }
  }

  private url(s: string): string {
    let u: URL;
    try { u = new URL(s); } catch { return bad("EINVAL", `bad URL: ${s}`); }
    if (u.protocol !== "http:" && u.protocol !== "https:") bad("ENOTSUP", `URL scheme: ${u.protocol}`);
    if (u.username || u.password) bad("ENOTSUP", "credentials in URLs");
    return u.href;
  }
}
