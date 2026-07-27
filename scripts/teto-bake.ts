#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function bakeCli(): string {
  const override = process.env.BAKE_CLI;
  if (override !== undefined && override.length > 0) {
    const selected = path.resolve(root, override);
    if (!fs.existsSync(selected)) fail(`BAKE_CLI does not exist: ${selected}`);
    return selected;
  }

  for (const relative of ["bake/dist/cli.js", "bake/src/cli.ts"]) {
    const candidate = path.join(root, relative);
    if (fs.existsSync(candidate)) return candidate;
  }

  fail("Bake submodule is missing; run git submodule update --init --recursive");
}

function main(): void {
  fs.rmSync(bakedRoot, { recursive: true, force: true });
  fs.rmSync(bakeReport, { force: true });
  fs.mkdirSync(path.dirname(bakedRoot), { recursive: true });

  const cli = bakeCli();
  process.stdout.write(`Teto Bake: using pinned sibling tool ${path.relative(root, cli)}\n`);
  run([
    process.execPath,
    cli,
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
