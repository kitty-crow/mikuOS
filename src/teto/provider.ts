import { loadTeto } from "./loader.js";
import type { TetoImageProvider, TetoVariant } from "./loader.js";

export type KernelMode = "thistle" | "teto" | "auto";

export const kernelMode = (value: string | null | undefined, fallback: KernelMode = "thistle"): KernelMode => {
  if (value === "thistle" || value === "teto" || value === "auto") return value;
  return fallback;
};

export const cachedTetoProvider = (source: TetoImageProvider): TetoImageProvider => {
  const cache = new Map<TetoVariant, Promise<Uint8Array<ArrayBuffer>>>();
  return {
    load(variant) {
      let pending = cache.get(variant);
      if (!pending) {
        pending = source.load(variant).then(bytes => Uint8Array.from(bytes));
        cache.set(variant, pending);
      }
      return pending;
    },
  };
};

export const fetchTetoProvider = (base: string | URL): TetoImageProvider => {
  const root = base instanceof URL ? base : new URL(base, document.baseURI);
  return cachedTetoProvider({
    async load(variant) {
      const name = variant === "threads" ? "teto-threads.wasm" : "teto.wasm";
      const response = await fetch(new URL(name, root), { cache: "no-store" });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  });
};

/** Validate that the provider supplies a genuine generated Teto kernel module. */
export const validateTetoProvider = async (provider: TetoImageProvider): Promise<void> => {
  const bytes = await provider.load("baseline");
  const runtime = await loadTeto(bytes, { initialPages: 1024, maximumPages: 32768 });
  if (runtime.exports.tetoKernelInit(0, 1, 0) !== 0 || runtime.exports.tetoKernelValid(0) !== 1) {
    throw new Error("Teto startup validation failed");
  }
};
