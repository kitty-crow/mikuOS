import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const supported = new Set(["--test-cli", "--test-web", "--validate-only"]);
for (const arg of args) {
  if (!supported.has(arg)) throw new Error("Unsupported Teto build option: " + arg);
}
const task = args.includes("--validate-only") ? "teto:validate" : "build";
const run = (script: string): void => {
  const result = spawnSync("bun", ["run", script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(task);
if (args.includes("--test-cli")) run("teto:test:cli");
if (args.includes("--test-web")) {
  const result = spawnSync("bun", ["run", "src/main/server.ts"], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}
