/**
 * Stage direct TypeScript imports from the SAME immutable Thistle checkout
 * that Bake and Baguette use for production Teto. No native kernel file is
 * maintained in mikuOS. --check verifies byte-for-byte equivalence.
 */
import { spawnSync } from "node:child_process";
import { mkdir, readFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const upstream = resolve(root, "deps/teto/build/thistle-source");
const shaFile = resolve(root, "deps/teto/build/thistle-source.sha");
const recorded = (await readFile(shaFile, "utf8")).trim();
const git = spawnSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" });
if (!/^[0-9a-f]{40}$/.test(recorded) || git.status !== 0 || git.stdout.trim() !== recorded) {
  throw new Error("Native staging requires the exact recorded canonical Thistle checkout");
}
for (const args of [["diff", "--quiet"], ["diff", "--cached", "--quiet"]]) {
  if (spawnSync("git", ["-C", upstream, ...args]).status !== 0) {
    throw new Error("Canonical Thistle checkout contains modified tracked source");
  }
}
const files = [
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
  const expected = await readFile(resolve(upstream, from));
  const destination = resolve(root, to);
  if (verifyOnly) {
    const current = await readFile(destination);
    if (!current.equals(expected)) throw new Error(`Generated ${to} differs from Thistle ${recorded}: ${from}`);
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(upstream, from), destination);
  }
}
console.log(`${verifyOnly ? "Verified" : "Staged"} ${files.length} native source files from Thistle ${recorded}; no independent Teto kernel source`);
