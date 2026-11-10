/* Standalone mikuOS starts the tiny C/WASM boot screen first.
 * Only after the screen is visible does the main thistle.js download begin. */
(async () => {
  const el = document.querySelector("[data-thistle-terminal]") ||
    document.querySelector("#terminal");
  if (!el) throw new Error("mikuOS terminal element missing");
  const term = new Terminal({ convertEol: true, cursorBlink: true });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(el);
  try { await document.fonts?.ready; } catch { /* Use the fallback font. */ }
  fit.fit();
  const onResize = () => fit.fit();
  window.addEventListener("resize", onResize);
  const boot = await MikuBoot.create(term, new URL("./", document.baseURI));
  try {
    await MikuBoot.loadRuntime("./thistle.js");
    const runtime = await Thistle.launchThistle({ terminal: term, boot });
    globalThis.MikuOS = runtime;
  } catch (error) {
    boot.fail(error);
    console.error(error);
  }
})().catch(console.error);
