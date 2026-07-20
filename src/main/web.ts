import { DEFAULT_CONFIG } from "../core/config.js";
import type { SystemConfig } from "../core/config.js";
import { WebSession } from "./websession.js";
import { staticBrowserConfig } from "./config.js";
import { fetchTetoProvider, kernelMode } from "../teto/provider.js";
import type { KernelMode } from "../teto/provider.js";
import { WebTree } from "./webtree.js";

interface TerminalCtor {
  new(options?: { convertEol?: boolean }): TerminalLike;
}

interface TerminalLike {
  rows?: number;
  cols?: number;
  loadAddon?(addon: unknown): void;
  open(node: unknown): void;
  focus?(): void;
  write(text: string): void;
  onData(listener: (value: string) => void): { dispose(): void };
  onResize?(listener: (size: { rows: number; cols: number }) => void): { dispose(): void };
  dispose?(): void;
}

interface FitAddonCtor { new(): { fit?(): void; dispose?(): void }; }
class FallbackTerminal implements TerminalLike {
  rows = 24;
  cols = 80;
  open(): void {}
  focus(): void {}
  write(): void {}
  onData(): { dispose(): void } { return { dispose: () => {} }; }
}

interface LaunchOptions {
  terminal?: TerminalLike | object;
  config?: SystemConfig;
  persistence?: boolean;
  kernel?: KernelMode;
  tetoBase?: string | URL;
  rootBase?: string | URL;
}

interface LaunchHandle {
  persistent: boolean;
  kernel: "thistle" | "teto";
  session: WebSession;
  dispose(): void;
}

const globals = globalThis as unknown as {
  Terminal?: TerminalCtor;
  MikuOS?: LaunchHandle;
  FitAddon?: { FitAddon?: FitAddonCtor };
  ResizeObserver?: new(callback: () => void) => { observe(node: unknown): void; disconnect(): void };
};

type FrameCallback = (time: number) => void;
type FrameHandle = number | ReturnType<typeof setTimeout>;

const requestFrame = (callback: FrameCallback): FrameHandle => {
  const request = (
    globalThis as unknown as {
      requestAnimationFrame?: (callback: FrameCallback) => number;
    }
  ).requestAnimationFrame;

  return request
    ? request(callback)
    : setTimeout(() => callback(Date.now()), 0);
};

const cancelFrame = (handle: FrameHandle): void => {
  const cancel = (
    globalThis as unknown as {
      cancelAnimationFrame?: (handle: number) => void;
    }
  ).cancelAnimationFrame;

  if (cancel && typeof handle === "number") {
    cancel(handle);
    return;
  }

  clearTimeout(handle as ReturnType<typeof setTimeout>);
};

const terminalNode = (): unknown =>
  document.querySelector("[data-thistle-terminal]") ??
  document.querySelector("#terminal");

export const launchThistle = async (options: LaunchOptions = {}): Promise<LaunchHandle> => {
  const node = options.terminal ?? terminalNode();
  if (!node) throw new Error("missing terminal element");
  const provided = typeof node === "object" && node !== null && "write" in node && "onData" in node;
  const term: TerminalLike = provided
    ? node as TerminalLike
    : new (globals.Terminal ?? FallbackTerminal)({
        /*
         * mikuOS emits Unix LF line endings. xterm must also return the
         * cursor to column zero for each LF, matching a normal terminal.
         */
        convertEol: true,
      });
  const addon = globals.FitAddon?.FitAddon ? new globals.FitAddon.FitAddon() : undefined;
  if (addon) term.loadAddon?.(addon);
  if (!provided) term.open(node);
  term.focus?.();

  /*
   * xterm begins with its fallback 80x24 geometry. Wait until the terminal
   * element and fonts have measurable dimensions, then fit it before the
   * guest session is created. This ensures the startup banner and MOTD use
   * the real number of rows and columns.
   */
  if (addon && !provided) {
    try {
      await document.fonts?.ready;
    } catch {
      /* Font loading failure must not prevent mikuOS from booting. */
    }

    await new Promise<void>(resolve =>
      requestFrame(() => resolve())
    );

    addon.fit?.();

    await new Promise<void>(resolve =>
      requestFrame(() => resolve())
    );

    addon.fit?.();
  }

  const config = options.config ?? await staticBrowserConfig();
  const query = typeof location === "undefined" ? undefined : new URL(location.href).searchParams.get("kernel");
  const requestedKernel = options.kernel ?? kernelMode(query, "teto");
  const teto = requestedKernel === "thistle"
    ? undefined
    : fetchTetoProvider(options.tetoBase ?? new URL("./teto/", document.baseURI));
  const tree = new WebTree(
    options.rootBase ?? new URL("./root/", document.baseURI),
    options.persistence !== false,
  );
  const session = new WebSession(
    { write: text => term.write(text) },
    { config, tree, kernelMode: requestedKernel, ...(teto ? { teto } : {}) },
  );

  /*
   * WebSession starts booting immediately. Apply the fitted geometry before
   * its first asynchronous boot step can print the banner, MOTD or prompt.
   */
  session.resize(
    term.rows ?? 24,
    term.cols ?? 80,
  );

  const data = term.onData(value => session.key(value));
  const resize = term.onResize?.((size: { rows: number; cols: number }) => session.resize(size.rows, size.cols));

  let fitFrame: FrameHandle | undefined;

  const fitTerminal = (): void => {
    if (!addon) return;

    if (fitFrame !== undefined) {
      cancelFrame(fitFrame);
    }

    fitFrame = requestFrame(() => {
      fitFrame = undefined;
      addon.fit?.();
    });
  };

  const observer = globals.ResizeObserver && addon && !provided
    ? new globals.ResizeObserver(fitTerminal)
    : undefined;

  observer?.observe(node);

  if (!provided) {
    window.addEventListener("resize", fitTerminal);
  }

  fitTerminal();

  await session.ready;

  fitTerminal();
  requestFrame(fitTerminal);
  session.resize(term.rows ?? 24, term.cols ?? 80);
  if (typeof document !== "undefined") {
    if (document.documentElement?.dataset) document.documentElement.dataset.kernel = session.os.activeKernelMode;
    const status = document.querySelector<HTMLElement>("#runtime-status");
    if (status) status.textContent = session.os.activeKernelMode === "teto"
      ? "Teto WASM core active"
      : "Thistle TypeScript core active";
  }
  const command = typeof location === "undefined" ? null : new URL(location.href).searchParams.get("command");
  if (command) {
    const code = await session.os.run(command);
    if (typeof document !== "undefined") {
      if (document.documentElement?.dataset) document.documentElement.dataset.commandExit = String(code);
      const status = document.querySelector<HTMLElement>("#runtime-status");
      if (status) status.textContent += ` · command exit ${code}`;
    }
  }
  return {
    persistent: tree.persistent,
    kernel: session.os.activeKernelMode,
    session,
    dispose: () => {
      data.dispose();
      resize?.dispose();
      observer?.disconnect();

      if (!provided) {
        window.removeEventListener("resize", fitTerminal);
      }

      if (fitFrame !== undefined) {
        cancelFrame(fitFrame);
      }

      addon?.dispose?.();
      term.dispose?.();
    },
  };
};

if (typeof document !== "undefined") {
  document.documentElement.lang = "en-GB";
  document.title = DEFAULT_CONFIG.os.prettyName;
  const autoLaunch = async (): Promise<void> => {
    globals.MikuOS = await launchThistle();
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => { void autoLaunch().catch(console.error); }, { once: true });
  } else {
    void autoLaunch().catch(console.error);
  }
}
