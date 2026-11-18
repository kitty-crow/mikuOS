import { boot } from "../src/main/boot.ts";
import { DEFAULT_CONFIG } from "../src/core/config.ts";

const os = boot({
  config: DEFAULT_CONFIG,
  put: () => {},
});

await os.ready;

const builtins: unknown = JSON.parse(
  os.s.read("/usr/share/mikuos/builtin-commands.json"),
);

if (typeof builtins !== "object" || builtins === null || !("schema" in builtins) || builtins.schema !== 1 || !("commands" in builtins) || !Array.isArray(builtins.commands)) throw new Error("bad built-in manifest schema");
if (builtins.commands.length !== os.s.apps().length) {
  throw new Error("built-in manifest count does not match the app registry");
}

const compiler: unknown = JSON.parse(
  os.s.read("/usr/share/mikuos/compiler-infrastructure.json"),
);

if (typeof compiler !== "object" || compiler === null || !("schema" in compiler) || compiler.schema !== 1) throw new Error("bad compiler manifest schema");

for (const app of os.s.apps()) {
  const path = `/usr/libexec/mikuos/builtin/${app.name}`;
  if (os.s.stat(path).mode !== 0o755) throw new Error(`bad rescue mode: ${path}`);
  const code = await os.run(`${path} --help`, [], false);
  if (code !== 0) throw new Error(`rescue help failed: ${path}`);
}

console.log(`Stage 0A verified ${builtins.commands.length} built-in rescue paths`);
