#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BAKE_COMMIT = "6d7f8bfd56c710390b6773e7ca11dfb2089f6980";
const BAKE_PACKAGE = `git+https://github.com/kitty-crow/bake.git#${BAKE_COMMIT}`;
const root = path.resolve(import.meta.dir, "..");
const bakedRoot = path.join(root, "build/teto-baked");
const bakeReport = path.join(root, "build/teto-bake-report.json");

function fail(message: string): never {
  throw new Error(message);
}

function run(command: readonly string[]): void {
  const executable = command[0];
  if (executable === undefined) fail("Bake command has no executable");
  const result = spawnSync(executable, command.slice(1), {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) fail(`Bake could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`Bake exited with status ${result.status ?? -1}`);
}

function localBakeCli(): string | undefined {
  const override = process.env.BAKE_CLI;
  if (override !== undefined && override.length > 0) return path.resolve(root, override);

  const directories = [
    path.join(root, "bake"),
    path.resolve(root, "../bake"),
    path.resolve(root, "../../bake"),
  ];
  for (const directory of directories) {
    for (const relative of ["dist/cli.js", "src/cli.ts"]) {
      const candidate = path.join(directory, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function bakeCommand(): string[] {
  const local = localBakeCli();
  if (local !== undefined) {
    process.stdout.write(`Teto Bake: using local checkout at ${path.relative(root, local)}\n`);
    return [process.execPath, local];
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  process.stdout.write(`Teto Bake: using pinned commit ${BAKE_COMMIT}\n`);
  return [npm, "exec", "--yes", `--package=${BAKE_PACKAGE}`, "--", "bake"];
}

function main(): void {
  fs.rmSync(bakedRoot, { recursive: true, force: true });
  fs.rmSync(bakeReport, { force: true });
  fs.mkdirSync(path.dirname(bakedRoot), { recursive: true });

  run([
    ...bakeCommand(),
    "--engine", process.env.MIKUOS_BAKE_ENGINE ?? "auto",
    "--project", path.join(root, "tsconfig.teto.json"),
    "--out-dir", bakedRoot,
    "--report", bakeReport,
    "--fail-on-warnings",
  ]);

  for (const relative of [
    "abi.ts",
    "kernel.ts",
    "vfs.ts",
    "thx.ts",
    "start.ts",
    "types.ts",
    "memory.ts",
    "word.ts",
    "tsconfig.json",
  ]) {
    const output = path.join(bakedRoot, relative);
    if (!fs.existsSync(output)) fail(`Bake did not emit required Teto source ${output}`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`Teto Bake failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
