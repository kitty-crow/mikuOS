import { requireValue } from "../core/err.js";
import { withValue } from "../core/err.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import type { SystemConfig } from "../core/config.js";
import { WebSession } from "./websession.js";
import { staticBrowserConfig } from "./config.js";
import { fetchTetoProvider, kernelMode } from "../teto/provider.js";
import type { KernelMode } from "../teto/provider.js";
import { WebTree } from "./webtree.js";

interface TerminalCtor {
  new(options: { convertEol: boolean | null } | null): TerminalLike;
}

interface TerminalLike {
  rows: number | null;
  cols: number | null;
  loadAddon: ((addon: TerminalAddon) => void) | null;
  open(node: HTMLElement): void;
  focus: (() => void) | null;
  write(text: string): void;
  onData(listener: (value: string) => void): { dispose(): void };
  onResize: ((listener: (size: { rows: number; cols: number }) => void) => { dispose(): void }) | null;
  dispose: (() => void) | null;
}

interface TerminalAddon { fit: (() => void) | null; dispose: (() => void) | null; }
interface FitAddonCtor { new(): TerminalAddon; }
class FallbackTerminal implements TerminalLike {
  "loadAddon": ((addon: TerminalAddon) => void) | null = null;
  "onResize": ((listener: (size: { rows: number; cols: number; }) => void) => { dispose(): void; }) | null = null;
  "dispose": (() => void) | null = null;

  rows = 24;
  cols = 80;
  open(): void {}
  focus(): void {}
  write(): void {}
  onData(): { dispose(): void } { return { dispose: () => {} }; }
}

interface BootDisplay {
  report(phase: number, done: number | null, total: number | null): void;
  finish(): void;
  fail<T>(error: T): void;
}
interface LaunchOptions {
  terminal: TerminalLike | object | null;
  /** A C/WASM boot screen that may already be running before thistle.js loaded. */
  boot: BootDisplay | null;
  config: SystemConfig | null;
  persistence: boolean | null;
  kernel: KernelMode | null;
  tetoBase: string | URL | null;
  rootBase: string | URL | null;
}

interface LaunchHandle {
  persistent: boolean;
  kernel: "thistle" | "teto";
  session: WebSession;
  dispose(): void;
}

const globals = globalThis as typeof globalThis & {
  Terminal: TerminalCtor | null;
  MikuOS: LaunchHandle | null;
  FitAddon: { FitAddon: FitAddonCtor | null } | null;
  ResizeObserver: (new(callback: () => void) => { observe(node: Element): void; disconnect(): void }) | null;
  MikuBoot: { create(term: TerminalLike, base: string | URL | null): Promise<BootDisplay> } | null;
};

type FrameCallback = (time: number) => void;
type FrameHandle = number | ReturnType<typeof setTimeout>;

const requestFrame = (callback: FrameCallback): FrameHandle => {
  const request = (
    globalThis as typeof globalThis & {
      requestAnimationFrame: ((callback: FrameCallback) => number) | null;
    }
  ).requestAnimationFrame;

  return request
    ? request(callback)
    : setTimeout(() => callback(Date.now()), 0);
};

const cancelFrame = (handle: FrameHandle): void => {
  const cancel = (
    globalThis as typeof globalThis & {
      cancelAnimationFrame: ((handle: number) => void) | null;
    }
  ).cancelAnimationFrame;

  if (cancel && typeof handle === "number") {
    cancel(handle);
    return;
  }

  clearTimeout(handle as ReturnType<typeof setTimeout>);
};

const terminalNode = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("[data-thistle-terminal]") ??
  document.querySelector<HTMLElement>("#terminal");

export const launchThistle = async (options: LaunchOptions = {"terminal": null, "boot": null, "config": null, "persistence": null, "kernel": null, "tetoBase": null, "rootBase": null}): Promise<LaunchHandle> => {
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
  const Fit = withValue(globals.FitAddon ?? null, value => value.FitAddon) ?? null;
  const addon = Fit ? new Fit() : null;
  if (addon) withValue(term.loadAddon ?? null, callable => callable.call(term, addon));
  if (!provided) term.open(node as HTMLElement);
  withValue(term.focus ?? null, callable => callable.call(term));

  /*
   * xterm begins with its fallback 80x24 geometry. Wait until the terminal
   * element and fonts have measurable dimensions, then fit it before the
   * guest session is created. This ensures the startup banner and MOTD use
   * the real number of rows and columns.
   */
  if (addon && !provided) {
    try {
      await withValue(document.fonts ?? null, value => value.ready);
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
    } catch {
      /* Font loading failure must not prevent mikuOS from booting. */
    }

    await new Promise<void>(resolve =>
      requestFrame(() => resolve())
    );

    withValue(addon.fit ?? null, callable => callable.call(addon));

    await new Promise<void>(resolve =>
      requestFrame(() => resolve())
    );

    withValue(addon.fit ?? null, callable => callable.call(addon));
  }

  const bootScreen = options.boot ?? (await (withValue(globals.MikuBoot ?? null, value => value.create(term, new URL("./", document.baseURI))) ?? null) ?? null);
  withValue(bootScreen ?? null, value => value.report(1, null, null));
  const config = options.config ?? await staticBrowserConfig(null);
  const query = typeof location === "undefined" ? null : new URL(location.href).searchParams.get("kernel");
  const requestedKernel = options.kernel ?? kernelMode(query, "teto");
  const teto = requestedKernel === "thistle"
    ? null
    : fetchTetoProvider(options.tetoBase ?? new URL("./teto/", document.baseURI));
  const tree = new WebTree(
    options.rootBase ?? new URL("./root/", document.baseURI),
    options.persistence !== false,
    (phase, done, total) => (withValue(bootScreen ?? null, value => value.report(phase, done, total)) ?? null),
  );
  // Hold the MOTD and the first shell prompt outside the boot screen's
  // alternate terminal buffer. They are rendered when the C programme exits.
  const pending: string[] = [];
  let showShell = !bootScreen;
  const terminalOutput = { halt: null, write: (text: string): void => {
    if (showShell) term.write(text);
    else pending.push(text);
  } };
  const session = new WebSession(
    terminalOutput,
    {"net": null, config, tree, kernelMode: requestedKernel,
      teto,
      onBootProgress: phase => (withValue(bootScreen ?? null, value => value.report(phase, null, null)) ?? null),
    },
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
  const resize = withValue(term.onResize ?? null, callable => callable.call(term, (size: { rows: number; cols: number }) => session.resize(size.rows, size.cols)));

  let fitFrame: FrameHandle | null = null;

  const fitTerminal = (): void => {
    if (!addon) return;

    if (fitFrame !== null) {
      cancelFrame(fitFrame);
    }

    fitFrame = requestFrame(() => {
      fitFrame = null;
      withValue(addon.fit ?? null, callable => callable.call(addon));
    });
  };

  const observer = globals.ResizeObserver && addon && !provided
    ? new globals.ResizeObserver(fitTerminal)
    : null;

  withValue(observer ?? null, value => value.observe(node as Element));

  if (!provided) {
    window.addEventListener("resize", fitTerminal);
  }

  fitTerminal();

  try {
    await session.ready;
    withValue(bootScreen ?? null, value => value.finish());
    showShell = true;
    for (const message of pending) term.write(message);
  } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    withValue(bootScreen ?? null, value => value.fail(error));
    throw error;
  }

  fitTerminal();
  requestFrame(fitTerminal);
  session.resize(term.rows ?? 24, term.cols ?? 80);
  if (typeof document !== "undefined") {
    (withValue(document.documentElement ?? null, value => value.dataset)) && (document.documentElement.dataset.kernel = session.os.activeKernelMode);
    const status = document.querySelector<HTMLElement>("#runtime-status");
    (status) && (status.textContent = session.os.activeKernelMode === "teto"
      ? "Teto WASM core active"
      : "Thistle TypeScript core active");
  }
  const command = typeof location === "undefined" ? null : new URL(location.href).searchParams.get("command");
  if (command) {
    const code = await session.os.run(command);
    // DOM lifecycle work follows detection of the browser environment and session phase.
    //@cg-expect-warning
    if (typeof document !== "undefined") {
      (withValue(document.documentElement ?? null, value => value.dataset)) && (document.documentElement.dataset.commandExit = String(code));
      const status = document.querySelector<HTMLElement>("#runtime-status");
      (status) && (status.textContent += ` · command exit ${code}`);
    }
  }
  return {
    persistent: tree.persistent,
    kernel: session.os.activeKernelMode,
    session,
    dispose: () => {
      data.dispose();
      withValue(resize ?? null, value => value.dispose());
      withValue(observer ?? null, value => value.disconnect());

      if (!provided) {
        window.removeEventListener("resize", fitTerminal);
      }

      if (fitFrame !== null) {
        cancelFrame(fitFrame);
      }

      withValue(withValue(addon ?? null, value => value.dispose) ?? null, callable => callable.call(addon));
      if (!provided) withValue(term.dispose ?? null, callable => callable.call(term));
    },
  };
};

// Embedded hosts supply an existing xterm instance and own the document.
// The classic-script marker suppresses standalone auto-launch and page metadata.
if (typeof document !== "undefined" &&
    (withValue(document.currentScript ?? null, value => value.getAttribute("data-mikuos-embed")) ?? null) !== "true") {
  document.documentElement.lang = "en-GB";
  document.title = DEFAULT_CONFIG.os.prettyName;
  const autoLaunch = async (): Promise<void> => {
    globals.MikuOS = await launchThistle();
  };
  // DOM lifecycle work follows detection of the browser environment and session phase.
  //@cg-expect-warning
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => { autoLaunch().catch(console.error); }, { once: true });
  } else {
    autoLaunch().catch(console.error);
  }
}
