import { jsonObject, jsonText, parseJson } from "../core/json.js";
import { loadTeto } from "./loader.js";


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
  const module = await loadTeto(bytes, {"memory": null, "initialPages": null, "maximumPages": null,  threaded });
  const initialized = module.exports.tetoKernelInit(0, threaded ? 2 : 1, threaded ? 1 : 0);
  if (initialized !== 0) throw new Error(`${name}: kernel initialisation returned ${initialized}`);
  if (module.exports.tetoKernelValid(0) !== 1) throw new Error(`${name}: kernel validation failed`);
  return `${name}: ${bytes.byteLength.toLocaleString()} bytes, ABI initialisation passed`;
};

const main = async (): Promise<void> => {
  set("Loading the Baguette-generated Teto modules…");
  const response = await fetch("./teto/teto.manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`manifest: HTTP ${response.status}`);
  const manifest = jsonObject(parseJson(await response.text()));
  if ((manifest.name ?? null) !== "Teto") throw new Error("manifest does not identify Teto");
  if ((manifest.transpiler ?? null) !== "Baguette") throw new Error("manifest does not identify Baguette");

  const lines = [
    `Execution model: ${jsonText(manifest.executionModel ?? null)}`,
    `Compiler: ${jsonText(manifest.transpiler ?? null)}`,
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

main().catch(<T>(caughtValue: T) => { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
  set(`FAIL: ${error instanceof Error ? error.message : String(error)}`, "fail");
  console.error(error);
 });
