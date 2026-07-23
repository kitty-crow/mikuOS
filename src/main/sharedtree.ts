import { fileSum } from "../fs/tree.js";
import type { Tree, TreeEnt, TreeListener } from "../fs/tree.js";

interface SharedEntry {
  path: string;
  inode: string;
  kind: "file" | "directory" | "symlink";
  mode: number;
  uid: number;
  gid: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  version: number;
  nlink: number;
  size?: number;
  checksum?: string;
  data?: string;
  target?: string;
}
interface SharedSnapshot {
  schema: 1;
  filesystemId: string;
  generation: number;
  imageGeneration: number;
  entries: SharedEntry[];
}
interface Lease { leaseId: string; clientId: string; expiresAt: number; }
type Operation =
  | { op: "create"; path: string; kind: "file" | "directory" | "symlink"; mode: number; uid: number; gid: number; data?: string; target?: string }
  | { op: "write"; path: string; offset: number; data: string; truncate: true; expectedVersion?: number }
  | { op: "rename"; from: string; to: string; expectedVersion?: number; expectedTargetVersion: number | null }
  | { op: "unlink"; path: string; expectedVersion?: number }
  | { op: "rmdir"; path: string; expectedVersion?: number }
  | { op: "chmod"; path: string; mode: number; expectedVersion?: number }
  | { op: "chown"; path: string; uid: number; gid: number; expectedVersion?: number }
  | { op: "link"; from: string; to: string; expectedVersion?: number };

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const encode = (bytes: Uint8Array): string => {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const value = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    output += alphabet[(value >>> 18) & 63];
    output += alphabet[(value >>> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return output;
};
const decode = (value?: string): Uint8Array => {
  if (!value) return new Uint8Array();
  const output: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const chars = value.slice(index, index + 4);
    const numbers = [...chars].map(char => char === "=" ? 0 : alphabet.indexOf(char));
    if (numbers.some(number => number < 0)) throw new Error("invalid shared filesystem base64");
    const packed = (numbers[0]! << 18) | (numbers[1]! << 12) | (numbers[2]! << 6) | numbers[3]!;
    output.push((packed >>> 16) & 255);
    if (chars[2] !== "=") output.push((packed >>> 8) & 255);
    if (chars[3] !== "=") output.push(packed & 255);
  }
  return Uint8Array.from(output);
};

const persistent = (path: string): boolean =>
  !["/dev", "/proc", "/sys", "/run", "/tmp"].some(root => path === root || path.startsWith(`${root}/`));
const kind = (entry: TreeEnt): SharedEntry["kind"] => entry.k === "d" ? "directory" : entry.k === "f" ? "file" : "symlink";
const contentSum = (entry: TreeEnt): string => entry.sum ?? fileSum(entry.data ?? new Uint8Array());
const depth = (path: string): number => path.split("/").filter(Boolean).length;
const randomId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface SharedTreeOptions {
  token?: string;
  clientId?: string;
  fetcher?: typeof fetch;
  watchTimeoutMs?: number;
}

export class SharedTree implements Tree {
  readonly label: string;
  private readonly fetcher: typeof fetch;
  private readonly clientId: string;
  private lease: Lease | null = null;
  private baseline = new Map<string, SharedEntry>();
  private currentGeneration = 0;
  private image = 0;

  constructor(readonly endpoint: string | URL, private readonly options: SharedTreeOptions = {}) {
    this.label = `authoritative mikuOS userspace at ${String(endpoint)}`;
    this.fetcher = options.fetcher ?? fetch;
    this.clientId = options.clientId ?? randomId();
  }

  get imageVersion(): number { return this.image; }
  get generation(): number { return this.currentGeneration; }

  async pull(): Promise<TreeEnt[]> {
    await this.connect();
    return this.accept(await this.request<SharedSnapshot>("v1/snapshot"));
  }

  async push(entries: TreeEnt[], imageVersion = this.image): Promise<TreeEnt[]> {
    await this.connect();
    if (!this.baseline.size) await this.pull();
    const next = entries.filter(entry => persistent(entry.p));
    const operations = this.operations(next);
    if (!operations.length) return this.toTree([...this.baseline.values()]);
    const response = await this.request<{ snapshot: SharedSnapshot }>("v1/transactions", {
      method: "POST",
      body: JSON.stringify({
        schema: 1,
        transactionId: randomId(),
        clientId: this.clientId,
        leaseId: this.lease!.leaseId,
        baseGeneration: this.currentGeneration,
        imageGeneration,
        operations,
      }),
    });
    return this.accept(response.snapshot);
  }

  async subscribe(listener: TreeListener): Promise<() => void> {
    await this.connect();
    let stopped = false;
    void (async () => {
      while (!stopped) {
        try {
          const snapshot = await this.request<SharedSnapshot | null>(
            `v1/watch?after=${this.currentGeneration}&timeout=${this.options.watchTimeoutMs ?? 25_000}`,
          );
          if (!snapshot || stopped || snapshot.generation <= this.currentGeneration) continue;
          const entries = this.toTree(snapshot.entries);
          await listener(entries, snapshot.imageGeneration, snapshot.generation);
          if (snapshot.generation > this.currentGeneration) this.accept(snapshot);
        } catch (error) {
          if (stopped) return;
          await new Promise(resolve => setTimeout(resolve, 1_000));
          if (this.lease && this.lease.expiresAt < Date.now() + 5_000) {
            try { await this.heartbeat(); } catch { this.lease = null; }
          }
          if (error instanceof Error && /unauthorised/.test(error.message)) throw error;
        }
      }
    })();
    return () => { stopped = true; };
  }

  private async connect(): Promise<void> {
    if (this.lease && this.lease.expiresAt > Date.now() + 5_000) return;
    this.lease = await this.request<Lease>("v1/leases", {
      method: "POST",
      body: JSON.stringify({ clientId: this.clientId, ttlMs: 60_000 }),
    });
  }

  private async heartbeat(): Promise<void> {
    if (!this.lease) return this.connect();
    this.lease = await this.request<Lease>(`v1/leases/${encodeURIComponent(this.lease.leaseId)}/heartbeat`, {
      method: "POST",
      body: JSON.stringify({ ttlMs: 60_000 }),
    });
  }

  private accept(snapshot: SharedSnapshot): TreeEnt[] {
    if (snapshot.schema !== 1) throw new Error("unsupported authoritative filesystem schema");
    this.currentGeneration = snapshot.generation;
    this.image = snapshot.imageGeneration;
    this.baseline = new Map(snapshot.entries.map(entry => [entry.path, entry]));
    return this.toTree(snapshot.entries);
  }

  private toTree(entries: SharedEntry[]): TreeEnt[] {
    return entries
      .filter(entry => persistent(entry.path))
      .map(entry => ({
        p: entry.path,
        k: entry.kind === "directory" ? "d" : entry.kind === "file" ? "f" : "l",
        id: Number.isSafeInteger(Number(entry.inode)) ? Number(entry.inode) : this.hashId(entry.inode),
        mode: entry.mode,
        uid: entry.uid,
        gid: entry.gid,
        at: entry.atimeMs,
        mt: entry.mtimeMs,
        ct: entry.ctimeMs,
        ...(entry.kind === "file" ? { data: decode(entry.data), sum: entry.checksum, size: entry.size } : {}),
        ...(entry.kind === "symlink" ? { to: entry.target ?? "" } : {}),
      }));
  }

  private hashId(value: string): number {
    let hash = 0x811c9dc5;
    for (const code of new TextEncoder().encode(value)) { hash ^= code; hash = Math.imul(hash, 0x01000193); }
    return (hash >>> 0) || 1;
  }

  private operations(entries: TreeEnt[]): Operation[] {
    const current = new Map(entries.map(entry => [entry.p, entry]));
    const operations: Operation[] = [];
    const oldByInode = new Map<string, string[]>();
    const newById = new Map<number, string[]>();
    const mutatedInodes = new Set<string>();
    const contentDone = new Set<string>();
    const modeDone = new Set<string>();
    const ownerDone = new Set<string>();
    for (const entry of this.baseline.values()) {
      const paths = oldByInode.get(entry.inode) ?? [];
      paths.push(entry.path); oldByInode.set(entry.inode, paths);
    }
    for (const entry of entries) {
      const paths = newById.get(entry.id) ?? [];
      paths.push(entry.p); newById.set(entry.id, paths);
    }

    const renamedOld = new Set<string>();
    const renamedNew = new Set<string>();
    for (const [inode, oldPaths] of oldByInode) {
      const numeric = Number(inode);
      if (!Number.isSafeInteger(numeric)) continue;
      const newPaths = newById.get(numeric);
      if (oldPaths.length !== 1 || newPaths?.length !== 1) continue;
      const from = oldPaths[0]!, to = newPaths[0]!;
      if (from === to || current.has(from) || this.baseline.has(to)) continue;
      const old = this.baseline.get(from)!;
      operations.push({ op: "rename", from, to, expectedVersion: old.version, expectedTargetVersion: null });
      mutatedInodes.add(old.inode);
      renamedOld.add(from); renamedNew.add(to);
    }

    const removed = [...this.baseline.values()]
      .filter(entry => entry.path !== "/" && !current.has(entry.path) && !renamedOld.has(entry.path))
      .sort((a, b) => depth(b.path) - depth(a.path) || b.path.localeCompare(a.path));
    for (const entry of removed) {
      operations.push(entry.kind === "directory"
        ? { op: "rmdir", path: entry.path, expectedVersion: entry.version }
        : { op: "unlink", path: entry.path, expectedVersion: entry.version });
      mutatedInodes.add(entry.inode);
    }

    const firstById = new Map<number, string>();
    const added = entries
      .filter(entry => entry.p !== "/" && !this.baseline.has(entry.p) && !renamedNew.has(entry.p))
      .sort((a, b) => depth(a.p) - depth(b.p) || a.p.localeCompare(b.p));
    for (const entry of added) {
      const first = firstById.get(entry.id);
      if (first && entry.k !== "d") {
        operations.push({ op: "link", from: first, to: entry.p });
        continue;
      }
      firstById.set(entry.id, entry.p);
      operations.push({
        op: "create",
        path: entry.p,
        kind: kind(entry),
        mode: entry.mode,
        uid: entry.uid,
        gid: entry.gid,
        ...(entry.k === "f" ? { data: encode(entry.data ?? new Uint8Array()) } : {}),
        ...(entry.k === "l" ? { target: entry.to ?? "" } : {}),
      });
    }

    for (const entry of entries) {
      const oldPath = renamedNew.has(entry.p)
        ? [...renamedOld].find(path => Number(this.baseline.get(path)?.inode) === entry.id)
        : entry.p;
      const old = oldPath ? this.baseline.get(oldPath) : undefined;
      if (!old) continue;
      const expected = (): { expectedVersion?: number } =>
        mutatedInodes.has(old.inode) ? {} : { expectedVersion: old.version };
      if (
        entry.k === "f" &&
        !contentDone.has(old.inode) &&
        (old.kind !== "file" || old.checksum !== contentSum(entry))
      ) {
        operations.push({
          op: "write",
          path: entry.p,
          offset: 0,
          truncate: true,
          ...expected(),
          data: encode(entry.data ?? new Uint8Array()),
        });
        mutatedInodes.add(old.inode);
        contentDone.add(old.inode);
      }
      if (!modeDone.has(old.inode) && old.mode !== entry.mode) {
        operations.push({ op: "chmod", path: entry.p, mode: entry.mode, ...expected() });
        mutatedInodes.add(old.inode);
        modeDone.add(old.inode);
      }
      if (!ownerDone.has(old.inode) && (old.uid !== entry.uid || old.gid !== entry.gid)) {
        operations.push({ op: "chown", path: entry.p, uid: entry.uid, gid: entry.gid, ...expected() });
        mutatedInodes.add(old.inode);
        ownerDone.add(old.inode);
      }
    }
    return operations;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const root = this.endpoint instanceof URL ? this.endpoint : new URL(this.endpoint);
    const url = new URL(path, root.href.endsWith("/") ? root : new URL(`${root.href}/`));
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body !== undefined) headers.set("content-type", "application/json");
    if (this.options.token) headers.set("authorization", `Bearer ${this.options.token}`);
    const response = await this.fetcher(url, { ...init, headers, cache: "no-store" });
    const value = await response.text();
    const payload = value ? JSON.parse(value) as unknown : null;
    if (!response.ok) {
      const error = payload as { message?: string; code?: string } | null;
      throw new Error(`${error?.code ? `${error.code}: ` : ""}${error?.message ?? `HTTP ${response.status}`}`);
    }
    return payload as T;
  }
}
