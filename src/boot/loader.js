/* Minimal host bridge. Screen, logo, spinner and progress maths are C/WASM.
 * This script starts before thistle.js and does not import the main runtime. */
(function (global) {
  "use strict";
  const decoder = new TextDecoder("utf-8");

  async function create(terminal, base) {
    const source = new URL("boot.wasm", base || document.baseURI);
    const response = await fetch(source);
    if (!response.ok) throw new Error("mikuOS boot.wasm HTTP " + response.status);
    const bytes = await response.arrayBuffer();
    let instance;
    const module = await WebAssembly.instantiate(bytes, {
      env: { emit(pointer, size) {
        if (!instance || size < 0 || size > 20000) return;
        const data = new Uint8Array(instance.exports.memory.buffer, pointer, size);
        terminal.write(decoder.decode(data));
      } }
    });
    instance = module.instance;
    const wasm = instance.exports;
    let finished = false;
    wasm.boot_start(terminal.cols || 60, terminal.rows || 24);
    const spinner = setInterval(() => { if (!finished) wasm.boot_tick(); }, 150);
    const resize = terminal.onResize?.(size =>
      wasm.boot_resize(size.cols, size.rows));
    return {
      report(phase, done = 0, total = 0) {
        if (!finished) wasm.boot_update(phase, done, total);
      },
      finish() {
        if (finished) return;
        wasm.boot_update(8, 0, 0);
        finished = true;
        clearInterval(spinner);
        resize?.dispose();
        wasm.boot_finish();
      },
      fail(error) {
        if (finished) return;
        this.finish();
        terminal.write("\r\nmikuOS boot failed: " +
          (error instanceof Error ? error.message : String(error)) + "\r\n");
      },
      dispose() {
        if (!finished) {
          finished = true;
          clearInterval(spinner);
          resize?.dispose();
          wasm.boot_finish();
        }
      },
    };
  }

  // Starts a real browser script request. No blob URLs or dynamic evaluation.
  function loadRuntime(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.setAttribute("data-mikuos-embed", "true");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load mikuOS runtime"));
      document.head.appendChild(script);
    });
  }

  global.MikuBoot = Object.freeze({ create, loadRuntime });
})(globalThis);
