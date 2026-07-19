import { build } from "esbuild";
import { fsp } from "./host.js";

const fs = fsp();
const root = new URL("../../", import.meta.url);
const teto = new URL("dist/teto/", root);
const web = new URL("dist/web/", root);
const webTeto = new URL("teto/", web);

await fs.mkdir(webTeto, { recursive: true });
await Promise.all([
  fs.copyFile(new URL("teto.wasm", teto), new URL("teto.wasm", webTeto)),
  fs.copyFile(new URL("teto-threads.wasm", teto), new URL("teto-threads.wasm", webTeto)),
  fs.copyFile(new URL("teto.manifest.json", teto), new URL("teto.manifest.json", webTeto)),
  fs.copyFile(new URL("host-interface.d.ts", teto), new URL("host-interface.d.ts", webTeto)),
  fs.copyFile(new URL("src/teto/teto-test.html", root), new URL("teto-test.html", web)),
]);

await build({
  entryPoints: [decodeURIComponent(new URL("src/teto/web-smoke.ts", root).pathname)],
  outfile: decodeURIComponent(new URL("teto-test.js", web).pathname),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: ["es2022"],
  charset: "utf8",
  legalComments: "none",
  sourcemap: false,
  minify: false,
  treeShaking: true,
  logLevel: "warning",
});

console.log("prepared dist/web/teto-test.html and Baguette-generated Teto assets");
(globalThis as unknown as { process?: { exit(code?: number): never } }).process?.exit(0);
