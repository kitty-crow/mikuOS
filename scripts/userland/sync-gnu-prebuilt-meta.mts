import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface Entry {
  p: string;
  id: number;
  k: "d" | "f" | "l";
  mode: number;
  uid: number;
  gid: number;
  at: number;
  mt: number;
  ct: number;
  sum?: string;
  to?: string;
}
interface Manifest {
  ver: number;
  image: number;
  ent: Entry[];
}

const root = resolve(process.argv[2] ?? ".thistle.base");
const manifestPath = join(root, ".thistle-meta.json");
const data = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
if (data.ver !== 1 || !Array.isArray(data.ent)) {
  throw new Error("Invalid mikuOS root metadata");
}

const entries = new Map<string, Entry>();
let lastId = 0;
for (const entry of data.ent) {
  if (entries.has(entry.p)) throw new Error("Duplicate guest path: " + entry.p);
  entries.set(entry.p, entry);
  lastId = Math.max(lastId, entry.id);
}

const checksum = (bytes: Uint8Array): string => {
  let value = 0x811c9dc5;
  for (const byte of bytes) value = Math.imul(value ^ byte, 0x01000193);
  return `${bytes.length}:${(value >>> 0).toString(16)}`;
};

// Update only the new GNU files and the licence directories they need.
// Keep every unrelated inode, permission, ownership and timestamp intact.
const directories = [
  "/usr/share/licenses",
  "/usr/share/licenses/coreutils",
  "/usr/share/licenses/bash",
];
const files = [
  "/bin/head",
  "/bin/dd",
  "/bin/od",
  "/bin/bash",
  "/usr/share/licenses/coreutils/COPYING",
  "/usr/share/licenses/bash/COPYING",
];
for (const guestPath of [...directories, ...files]) {
  const hostPath = join(root, guestPath.slice(1));
  const info = await stat(hostPath);
  const kind = info.isDirectory() ? "d" : "f";
  if ((kind === "d") !== directories.includes(guestPath)) {
    throw new Error("Unexpected guest filesystem node type: " + guestPath);
  }
  const prior = entries.get(guestPath);
  const sum = kind === "f" ? checksum(await readFile(hostPath)) : undefined;
  const unchanged = prior?.k === kind && (kind !== "f" || prior.sum === sum);
  entries.set(guestPath, {
    p: guestPath,
    id: prior?.id ?? ++lastId,
    k: kind,
    mode: unchanged ? prior.mode : (info.mode & 0o7777),
    uid: prior?.uid ?? 0,
    gid: prior?.gid ?? 0,
    at: unchanged ? prior.at : Math.trunc(info.atimeMs),
    mt: unchanged ? prior.mt : Math.trunc(info.mtimeMs),
    ct: unchanged ? prior.ct : Math.trunc(info.ctimeMs),
    ...(kind === "f" ? { sum } : {}),
  });
}

entries.delete("/usr/libexec/mikuos/builtin/head");

const ordered = data.ent.filter(entry => entries.has(entry.p))
  .map(entry => entries.get(entry.p)!);
const already = new Set(ordered.map(entry => entry.p));
for (const [path, entry] of entries) {
  if (!already.has(path)) ordered.push(entry);
}
data.ent = ordered;
const updated = JSON.stringify(data, null, 2) + "\n";
const original = await readFile(manifestPath, "utf8");
if (original !== updated) {
  const temporary = manifestPath + ".gnu-tmp-" + process.pid;
  await writeFile(temporary, updated);
  await rename(temporary, manifestPath);
}
console.log("[mikuOS] Registered four native GNU executables and licence files in root metadata.");
