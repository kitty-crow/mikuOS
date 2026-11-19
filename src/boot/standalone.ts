import { withValue } from "../core/err.js";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import type { FitAddon as XtermFitAddon } from "@xterm/addon-fit";
import type { BootApi } from "./loader.js";
import type { launchThistle } from "../main/web.js";

const globals = globalThis as typeof globalThis & {
  Terminal: typeof XtermTerminal;
  FitAddon: { FitAddon: typeof XtermFitAddon };
  MikuBoot: BootApi;
  Thistle: { launchThistle: typeof launchThistle };
  MikuOS: Awaited<ReturnType<typeof launchThistle>> | null;
};

/* Standalone mikuOS starts the tiny C/WASM boot screen first.
 * Only after the screen is visible does the main thistle.js download begin. */
(async () => {
  const el = document.querySelector<HTMLElement>("[data-thistle-terminal]") ||
    document.querySelector<HTMLElement>("#terminal");
  if (!el) throw new Error("mikuOS terminal element missing");
  const term = new globals.Terminal({ convertEol: true, cursorBlink: true });
  const fit = new globals.FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(el);
  // This documented best-effort fallback intentionally continues after the optional operation fails.
  //@cg-expect-warning
  try { await withValue(document.fonts ?? null, value => value.ready); } catch { /* Use the fallback font. */ }
  fit.fit();
  const onResize = () => fit.fit();
  window.addEventListener("resize", onResize);
  const boot = await globals.MikuBoot.create({ element: term.element ?? null, cols: term.cols, rows: term.rows, write: text => term.write(text), onResize: listener => term.onResize(listener) }, new URL("./", document.baseURI));
  try {
    await globals.MikuBoot.loadRuntime("./thistle.js");
    const runtime = await globals.Thistle.launchThistle({"config": null, "persistence": null, "kernel": null, "tetoBase": null, "rootBase": null,  terminal: term, boot });
    globals.MikuOS = runtime;
  } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    boot.fail(error);
    console.error(error);
  }
})().catch(console.error);
