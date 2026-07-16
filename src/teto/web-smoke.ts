import { loadTeto } from "./loader.js";

interface TetoManifest {
  name: string;
  transpiler?: string;
  expansion: string;
  phase: string;
  completeKernel: boolean;
  variants: Record<string, string>;
}

const output = document.querySelector<HTMLElement>("[data-teto-status]");
const set = (text: string, state: "working" | "pass" | "fail" = "working"): void => {
  if (!output) return;
  output.textContent = text;
  output.dataset.state = state;
};

const get = async (url: string): Promise<Uint8Array<ArrayBuffer>> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

const testVariant = async (name: "teto" | "teto-threads", threaded: boolean): Promise<string> => {
  const bytes = await get(`./teto/${name}.wasm`);
  const module = await loadTeto(bytes, { threaded });
  const initialized = module.exports.tetoKernelInit(0, threaded ? 2 : 1, threaded ? 1 : 0);
  if (initialized !== 0) throw new Error(`${name}: kernel initialisation returned ${initialized}`);
  if (module.exports.tetoKernelValid(0) !== 1) throw new Error(`${name}: kernel validation failed`);
  return `${name}: ${bytes.byteLength.toLocaleString()} bytes, ABI initialisation passed`;
};

const main = async (): Promise<void> => {
  set("Loading the Baguette-generated Teto modules…");
  const response = await fetch("./teto/teto.manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`manifest: HTTP ${response.status}`);
  const manifest = await response.json() as TetoManifest;
  if (manifest.name !== "Teto") throw new Error("manifest does not identify Teto");
  if (manifest.transpiler !== "Baguette") throw new Error("manifest does not identify Baguette");

  const lines = [
    `Teto phase: ${manifest.phase}`,
    `Complete kernel: ${manifest.completeKernel ? "yes" : "no, development milestone"}`,
    await testVariant("teto", false),
  ];

  if (globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined") {
    lines.push(await testVariant("teto-threads", true));
  } else {
    lines.push("teto-threads: not instantiated because this preview is not cross-origin isolated");
  }

  lines.push("PASS: this page loaded and instantiated the real Baguette-generated WebAssembly output.");
  set(lines.join("\n"), "pass");
};

void main().catch(error => {
  set(`FAIL: ${error instanceof Error ? error.message : String(error)}`, "fail");
  console.error(error);
});
