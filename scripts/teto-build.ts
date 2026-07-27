#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface BaguetteVariantConfig {
  readonly name: string;
  readonly threaded?: boolean;
  readonly preludeFile?: string;
}

interface BaguetteConfig {
  readonly schema?: number;
  readonly name?: string;
  readonly project?: string;
  readonly entries: readonly string[];
  readonly generatedDir?: string;
  readonly outDir?: string;
  readonly moduleBaseName?: string;
  readonly preludeFile?: string;
  readonly intrinsicModules?: readonly string[];
  readonly variants?: readonly BaguetteVariantConfig[];
  readonly [key: string]: object | readonly object[] | readonly string[] | string | number | boolean | undefined;
}

const BAKE_COMMIT = "6d7f8bfd56c710390b6773e7ca11dfb2089f6980";
const BAKE_PACKAGE = `git+https://github.com/kitty-crow/bake.git#${BAKE_COMMIT}`;
const root = path.resolve(import.meta.dir, "..");
const kernelRoot = path.join(root, "src/teto");
const bakedRoot = path.join(root, "build/teto-baked");
const bakeReport = path.join(root, "build/teto-bake-report.json");
const derivedConfig = path.join(root, "build/teto-baguette.config.json");
const sourceConfigPath = path.join(root, "baguette.config.json");
const baguetteCompiler = path.join(root, "baguette/src/compiler.ts");

function fail(message: string): never {
  throw new Error(message);
}

function run(command: readonly string[], label: string): void {
  const executable = command[0];
  if (executable === undefined) fail(`${label} command has no executable`);
  const result = spawnSync(executable, command.slice(1), {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with status ${result.status ?? -1}`);
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
    process.stdout.write(`Teto build: using local Bake at ${path.relative(root, local)}\n`);
    return [process.execPath, local];
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  process.stdout.write(`Teto build: using pinned Bake ${BAKE_COMMIT}\n`);
  return [npm, "exec", "--yes", `--package=${BAKE_PACKAGE}`, "--", "bake"];
}

function absoluteFromRoot(value: string): string {
  return path.resolve(root, value);
}

function bakedPath(value: string): string {
  const source = absoluteFromRoot(value);
  const relative = path.relative(kernelRoot, source);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`Teto Bake input is outside src/teto: ${value}`);
  }
  return path.join(bakedRoot, relative);
}

function absolutePrelude(value: string | undefined): string | undefined {
  return value === undefined ? undefined : absoluteFromRoot(value);
}

function buildDerivedConfig(source: BaguetteConfig): BaguetteConfig {
  return {
    ...source,
    project: path.join(bakedRoot, "tsconfig.json"),
    entries: source.entries.map(bakedPath),
    generatedDir: absoluteFromRoot(source.generatedDir ?? "build/teto-generated"),
    outDir: absoluteFromRoot(source.outDir ?? "dist/teto"),
    preludeFile: absolutePrelude(source.preludeFile),
    intrinsicModules: (source.intrinsicModules ?? []).map(bakedPath),
    variants: source.variants?.map(variant => ({
      ...variant,
      preludeFile: absolutePrelude(variant.preludeFile),
    })),
  };
}

function main(): void {
  if (!fs.existsSync(sourceConfigPath)) fail(`Missing ${sourceConfigPath}`);
  if (!fs.existsSync(baguetteCompiler)) fail("Baguette submodule is missing; run git submodule update --init --recursive");

  fs.rmSync(bakedRoot, { recursive: true, force: true });
  fs.rmSync(bakeReport, { force: true });
  fs.rmSync(derivedConfig, { force: true });
  fs.mkdirSync(path.dirname(derivedConfig), { recursive: true });

  const engine = process.env.MIKUOS_BAKE_ENGINE ?? "auto";
  run([
    ...bakeCommand(),
    "--engine", engine,
    "--project", path.join(root, "tsconfig.teto.json"),
    "--out-dir", bakedRoot,
    "--report", bakeReport,
    "--fail-on-warnings",
  ], "Bake");

  const source = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8")) as BaguetteConfig;
  const config = buildDerivedConfig(source);
  for (const entry of config.entries) {
    if (!fs.existsSync(entry)) fail(`Bake did not emit required Teto entry ${entry}`);
  }
  fs.writeFileSync(derivedConfig, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const baguetteArguments = process.argv.slice(2);
  run([
    process.execPath,
    baguetteCompiler,
    "--config", derivedConfig,
    ...baguetteArguments,
  ], "Baguette");

  if (!baguetteArguments.includes("--validate-only")) {
    const webBuilder = path.join(root, "build/tool/teto-web.js");
    const webIndex = path.join(root, "dist/web/index.html");
    if (fs.existsSync(webBuilder) && fs.existsSync(webIndex)) {
      run([process.env.NODE ?? "node", webBuilder], "Teto web packaging");
    }
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`Teto build failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
