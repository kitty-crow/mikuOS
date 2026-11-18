export interface BootTerminal {
  element?: HTMLElement | undefined;
  cols?: number;
  rows?: number;
  write(text: string): void;
  onResize?(listener: (size: { cols: number; rows: number }) => void): { dispose(): void };
}

export interface BootDisplay {
  report(phase: number, done?: number, total?: number): void;
  finish(): void;
  fail(error: unknown): void;
  dispose(): void;
}

export interface BootApi {
  create(terminal: BootTerminal, base?: string | URL): Promise<BootDisplay>;
  loadRuntime(url: string): Promise<void>;
}

interface BootExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  boot_start(cols: number, rows: number): void;
  boot_tick(): void;
  boot_resize(cols: number, rows: number): void;
  boot_update(phase: number, done: number, total: number): void;
  boot_finish(): void;
}

/* Minimal host bridge. Screen, logo, spinner and progress maths are C/WASM.
 * This script starts before thistle.js and does not import the main runtime. */
(function (global: typeof globalThis & { MikuBoot?: BootApi }) {
  "use strict";
  const decoder = new TextDecoder("utf-8");

  // xterm.js lays out complete character cells from the left edge. The
  // remaining fractional width ends up on the right, which visibly shifts
  // a centred ANSI panel left. Centre the rendered grid within the actual
  // terminal viewport during boot, then restore its original placement.
  // The splash artwork and progress UI still render entirely inside WASM.
  function centreBootGrid(terminal: BootTerminal) {
    const host = terminal.element;
    const screen = host?.querySelector?.<HTMLElement>(".xterm-screen");
    if (!host?.getBoundingClientRect || !screen?.getBoundingClientRect ||
        !screen.style) {
      return { align() {}, restore() {} };
    }

    const previous = screen.style.transform;
    function align() {
      screen.style.transform = previous;
      const viewport = host.getBoundingClientRect();
      const grid = screen.getBoundingClientRect();
      const offset = Math.round(
        viewport.left + viewport.width / 2 - grid.left - grid.width / 2
      );
      if (Number.isFinite(offset) && offset !== 0) {
        screen.style.transform = (previous ? previous + " " : "") +
          "translateX(" + offset + "px)";
      }
    }
    align();
    return { align, restore() { screen.style.transform = previous; } };
  }

  async function create(terminal: BootTerminal, base?: string | URL): Promise<BootDisplay> {
    const source = new URL("boot.wasm", base || document.baseURI);
    const response = await fetch(source);
    if (!response.ok) throw new Error("mikuOS boot.wasm HTTP " + response.status);
    const bytes = await response.arrayBuffer();
    let instance: WebAssembly.Instance | undefined;
    const module = await WebAssembly.instantiate(bytes, {
      env: { emit(pointer: number, size: number) {
        if (!instance || size < 0 || size > 20000) return;
        const memory = instance.exports.memory;
        if (!(memory instanceof WebAssembly.Memory)) return;
        const data = new Uint8Array(memory.buffer, pointer, size);
        terminal.write(decoder.decode(data));
      } }
    });
    instance = module.instance;
    const wasm = instance.exports as BootExports;
    let finished = false;
    const alignment = centreBootGrid(terminal);
    wasm.boot_start(terminal.cols || 60, terminal.rows || 24);
    const spinner = setInterval(() => { if (!finished) wasm.boot_tick(); }, 150);
    const resize = terminal.onResize?.(size => {
      alignment.align();
      wasm.boot_resize(size.cols, size.rows);
    });
    return {
      report(phase: number, done = 0, total = 0) {
        if (!finished) wasm.boot_update(phase, done, total);
      },
      finish() {
        if (finished) return;
        wasm.boot_update(8, 0, 0);
        finished = true;
        clearInterval(spinner);
        resize?.dispose();
        wasm.boot_finish();
        alignment.restore();
      },
      fail(error: unknown) {
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
          alignment.restore();
        }
      },
    };
  }

  // Starts a real browser script request. No blob URLs or dynamic evaluation.
  function loadRuntime(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
