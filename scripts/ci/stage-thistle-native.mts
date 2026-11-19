import { fsp } from "../../src/tool/host.js";
import { ensure } from "../../src/core/err.js";
import { parseJson } from "../../src/core/json.js";
/**
 * Stage direct TypeScript imports from the exact Thistle gitlink and source
 * provenance recorded by Teto. No native kernel file is
 * maintained in mikuOS. --check verifies byte-for-byte equivalence.
 */
import { spawnSync } from "node:child_process";
import { readFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const teto = resolve(root, "deps/teto");
const upstream = resolve(teto, "thistle");
const manifest = parseJson(await readFile(resolve(teto, "teto.manifest.json"), "utf8"));
if (typeof manifest !== "object" || manifest === null || !("canonicalRevision" in manifest) ||
    typeof manifest.canonicalRevision !== "string" || !("canonicalSource" in manifest) ||
    !("toolchain" in manifest) || typeof manifest.toolchain !== "object" ||
    manifest.toolchain === null || !("Thistle" in manifest.toolchain)) {
  throw new Error("Invalid Teto provenance manifest");
}
const recorded = manifest.canonicalRevision;
const pin = spawnSync("git", ["-C", teto, "ls-tree", "HEAD", "thistle"], { encoding: "utf8" });
if (manifest.canonicalSource !== "Thistle" || manifest.toolchain.Thistle !== recorded ||
    pin.status !== 0 || !pin.stdout.startsWith(`160000 commit ${recorded}\tthistle`)) {
  throw new Error("Teto manifest and canonical Thistle gitlink disagree");
}
const checkedRoot = spawnSync("git", ["-C", upstream, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
if (checkedRoot.status !== 0 || checkedRoot.stdout.trim() !== upstream) {
  throw new Error("Canonical Thistle submodule is not initialised");
}
const git = spawnSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" });
if (!/^[0-9a-f]{40}$/.test(recorded) || git.status !== 0 || git.stdout.trim() !== recorded) {
  throw new Error("Native staging requires the exact recorded canonical Thistle checkout");
}
for (const args of [["diff", "--quiet"], ["diff", "--cached", "--quiet"]]) {
  if (spawnSync("git", ["-C", upstream, ...args]).status !== 0) {
    throw new Error("Canonical Thistle checkout contains modified tracked source");
  }
}
const files: readonly (readonly [string, string])[] = [
  ["src/native/image-range.ts", "src/teto/image-range.ts"],
  ["src/core/rv64-decode.ts", "src/core/rv64-decode.ts"],
  [
    "src/native/abi.ts",
    "src/teto/abi.ts"
  ],
  [
    "src/native/kernel.ts",
    "src/teto/kernel.ts"
  ],
  [
    "src/native/vfs.ts",
    "src/teto/vfs.ts"
  ],
  [
    "src/native/thx.ts",
    "src/teto/thx.ts"
  ],
  [
    "src/native/start.ts",
    "src/teto/start.ts"
  ],
  [
    "src/native/types.ts",
    "src/teto/types.ts"
  ],
  [
    "src/native/memory.ts",
    "src/teto/memory.ts"
  ],
  [
    "src/native/word.ts",
    "src/teto/word.ts"
  ],
  [
    "src/core/native-types.ts",
    "src/core/native-types.ts"
  ],
  [
    "src/core/rv64-arithmetic.ts",
    "src/core/rv64-arithmetic.ts"
  ],
  [
    "src/core/rv64-branch.ts",
    "src/core/rv64-branch.ts"
  ],
  [
    "src/core/rv64-fclass.ts",
    "src/core/rv64-fclass.ts"
  ],
  [
    "src/core/rv64-immediate-op.ts",
    "src/core/rv64-immediate-op.ts"
  ],
  [
    "src/core/rv64-numbers.ts",
    "src/core/rv64-numbers.ts"
  ],
  [
    "src/core/rv64-register.ts",
    "src/core/rv64-register.ts"
  ],
  [
    "src/core/rv64-word.ts",
    "src/core/rv64-word.ts"
  ],
  [
    "src/vm/rv64-immediate.ts",
    "src/vm/rv64-immediate.ts"
  ]
];
const verifyOnly = process.argv.includes("--check");
for (const [from, to] of files) {
  // Generation is only valid if the consumer has no independently tracked
  // kernel implementation that could drift from canonical Thistle.
  const tracked = spawnSync("git", ["-C", root, "ls-files", "--error-unmatch", to], { stdio: "ignore" });
  if (tracked.status === 0) throw new Error(`Refusing an independently tracked Thistle kernel copy: ${to}`);
  if (tracked.status !== 1) throw new Error(`Cannot verify tracked state of generated source: ${to}`);
  const expected = await readFile(resolve(upstream, from), null);
  const destination = resolve(root, to);
  if (verifyOnly) {
    const current = await readFile(destination, null);
    ensure(current.equals(expected), () => { throw new Error(`Generated ${to} differs from Thistle ${recorded}: ${from}`); });
  } else {
    await fsp().mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(upstream, from), destination);
  }
}
console.log(`${verifyOnly ? "Verified" : "Staged"} ${files.length} native source files from Thistle ${recorded}; no independent Teto kernel source`);
