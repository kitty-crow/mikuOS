import { demoWasm } from "../wasm/demo.js";
import { fsp } from "./host.js";
import { Asm } from "../asm/asm.js";
import { Link } from "../asm/link.js";
import { codec, Exe } from "../asm/fmt.js";
import { HELLO_TAS, libInc } from "../asm/lib.js";
import { build } from "esbuild";
import { WebRootPackage } from "../main/webroot.js";
import { ROOT_IMAGE_VERSION } from "../main/image.js";

const fs = fsp();
const root = new URL("../../", import.meta.url);
const src = new URL("src/", root);
const dst = new URL("build/", root);
const assets = new URL("assets/", root);
const web = new URL("dist/web/", root);
const webAssets = new URL("assets/", web);
const vendor = new URL("vendor/", web);
const bundle = new URL("thistle.js", web);
const neruBundle = new URL("neru-entry.js", web);
const neruEntry = new URL("web/neru-entry.ts", root);
const neruBrowser = new URL("neru/src/browser.ts", root);
const cliRoot = new URL(".thistle.base/", root);
const webRoot = new URL("root/", web);

await fs.mkdir(assets, { recursive: true });
await fs.writeFile(new URL("hello.wasm", assets), demoWasm());
const hello = new Asm((name) => libInc(name), { debug: true }).run(HELLO_TAS, "hello.tas").obj;
const helloThx = codec.pack(new Link().run([hello], { names: ["hello.to"] }).exe);
const rvMessage = new TextEncoder().encode("hello from Teto RV64GC\n");
const rvWords = [
  (1 << 20 | 10 << 7 | 0x13) >>> 0,
  (0x20 << 12 | 11 << 7 | 0x37) >>> 0,
  (rvMessage.length << 20 | 12 << 7 | 0x13) >>> 0,
  (64 << 20 | 17 << 7 | 0x13) >>> 0,
  0x00000073,
  (10 << 7 | 0x13) >>> 0,
  (93 << 20 | 17 << 7 | 0x13) >>> 0,
  0x00000073,
];
const rvText = new Uint8Array(rvWords.length * 4);
const rvView = new DataView(rvText.buffer);
rvWords.forEach((instruction, index) => rvView.setUint32(index * 4, instruction, true));
const rvHello = new Exe("thistle64");
rvHello.isa = "rv64gc";
rvHello.entry = 0x10000;
rvHello.sec.push(
  { name: ".text", flg: "rx", align: 4096, data: rvText, size: rvText.length, addr: 0x10000 },
  { name: ".rodata", flg: "r", align: 4096, data: rvMessage, size: rvMessage.length, addr: 0x20000 },
);
rvHello.ident.push("Generated RV64GC Teto execution fixture");
const rvHelloThx = codec.pack(rvHello);
await Promise.all([
  fs.writeFile(new URL("hello.txe", assets), helloThx),
  fs.writeFile(new URL("hello.thx", assets), helloThx),
  fs.writeFile(new URL("hello.39", assets), helloThx),
  fs.writeFile(new URL("hello-rv64.thx", assets), rvHelloThx),
  fs.writeFile(new URL("hello-rv64.39", assets), rvHelloThx),
]);
await fs.mkdir(dst, { recursive: true });
await fs.copyFile(new URL("README.md", root), new URL("README.md", dst));

for (const x of await fs.readdir(src, { withFileTypes: true })) {
  if (!x.isDirectory()) continue;
  try {
    const d = new URL(`${x.name}/`, dst);
    await fs.mkdir(d, { recursive: true });
    await fs.copyFile(new URL(`${x.name}/README.md`, src), new URL("README.md", d));
  } catch { /* Source-only helper folders don't owe the build a novel. */ }
}

await fs.mkdir(vendor, { recursive: true });
await fs.mkdir(webAssets, { recursive: true });
const packagedRoot = await new WebRootPackage(
  decodeURIComponent(cliRoot.pathname),
  decodeURIComponent(webRoot.pathname),
  ROOT_IMAGE_VERSION,
).build();
console.log(
  `web root: ${packagedRoot.entries.length} paths, ` +
  `${packagedRoot.core.unpackedSize} eager bytes, ` +
  `${packagedRoot.core.packedSize} packed bytes`,
);
await Promise.all([
  fs.copyFile(new URL("index.html", root), new URL("index.html", web)),
  fs.copyFile(new URL("coi-serviceworker.js", root), new URL("coi-serviceworker.js", web)),
  fs.copyFile(new URL("style.css", root), new URL("style.css", web)),
  fs.copyFile(new URL("mikuos.config.json", root), new URL("mikuos.config.json", web)),
  fs.copyFile(new URL("thistle.config.json", root), new URL("thistle.config.json", web)),
  fs.copyFile(new URL("node_modules/@xterm/xterm/lib/xterm.js", root), new URL("xterm.js", vendor)),
  fs.copyFile(new URL("node_modules/@xterm/addon-fit/lib/addon-fit.js", root), new URL("xterm-fit.js", vendor)),
  fs.copyFile(new URL("node_modules/@xterm/xterm/css/xterm.css", root), new URL("xterm.css", vendor)),
  fs.copyFile(new URL("hello.thx", assets), new URL("hello.thx", webAssets)),
  fs.copyFile(new URL("hello.39", assets), new URL("hello.39", webAssets)),
  fs.copyFile(new URL("hello-rv64.thx", assets), new URL("hello-rv64.thx", webAssets)),
  fs.copyFile(new URL("hello-rv64.39", assets), new URL("hello-rv64.39", webAssets)),
]);

await build({
  entryPoints: [decodeURIComponent(new URL("main/web.js", dst).pathname)],
  outfile: decodeURIComponent(bundle.pathname),
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "Thistle",
  target: ["es2022"],
  charset: "utf8",
  legalComments: "none",
  sourcemap: false,
  minify: false,
  treeShaking: true,
  external: ["node:*"],
  logOverride: { "empty-import-meta": "silent" },
  logLevel: "warning",
});

let haveNeruSource = true;
try {
  await fs.access(neruBrowser);
} catch {
  haveNeruSource = false;
}

if (haveNeruSource) {
  await build({
    entryPoints: [decodeURIComponent(neruEntry.pathname)],
    outfile: decodeURIComponent(neruBundle.pathname),
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "NeruEntry",
    target: ["es2022"],
    charset: "utf8",
    legalComments: "none",
    sourcemap: false,
    minify: false,
    treeShaking: true,
    external: ["node:*"],
    logOverride: { "empty-import-meta": "silent" },
    logLevel: "warning",
  });
} else {
  await fs.writeFile(
    neruBundle,
    "document.querySelector('#runtime-status').textContent = " +
      "'NERU is unavailable: initialise the neru submodule and run npm run build:neru';\n",
  );
}

const runtime = await fs.readFile(bundle, "utf8");
const forbidden: Array<[RegExp, string]> = [
  [/\bWebSocket\b/, "WebSocket"],
  [/__thistle\//, "runtime-service route"],
  [/["']node:/, "Node module"],
  [/\bBun\b/, "Bun global"],
  [/\bglobalThis\.process\b/, "Node process global"],
  [/\brequire\s*\(/, "CommonJS require"],
  [/^\s*import\s/m, "unresolved static import"],
  [/\bimport\s*\(/, "unresolved dynamic import"],
];

if (!runtime.includes("var Thistle =") || !runtime.includes("launchThistle")) {
  throw new Error("static web bundle does not expose the Thistle launch API");
}

for (const [pattern, label] of forbidden) {
  if (pattern.test(runtime)) {
    throw new Error(`static web bundle contains forbidden ${label}`);
  }
}
