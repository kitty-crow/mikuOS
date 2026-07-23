import { bootNeruBrowser } from "../neru/src/browser.ts";
import { staticBrowserConfig } from "../src/main/config.ts";

interface TerminalLike {
  loadAddon?(addon: unknown): void;
  open(node: unknown): void;
  focus?(): void;
  write(text: string): void;
  onData(listener: (value: string) => void): { dispose(): void };
  dispose?(): void;
}

interface TerminalCtor {
  new(options?: { convertEol?: boolean }): TerminalLike;
}

interface FitAddonCtor {
  new(): { fit?(): void; dispose?(): void };
}

const globals = globalThis as unknown as {
  Terminal?: TerminalCtor;
  FitAddon?: { FitAddon?: FitAddonCtor };
  MikuOS?: unknown;
};

const launch = async (): Promise<void> => {
  const status = document.querySelector<HTMLElement>("#runtime-status");
  const node = document.querySelector("[data-thistle-terminal]") ??
    document.querySelector("#terminal");
  if (!node) throw new Error("missing terminal element");
  if (!globals.Terminal) throw new Error("xterm.js did not load");

  const terminal = new globals.Terminal({ convertEol: true });
  const addon = globals.FitAddon?.FitAddon ? new globals.FitAddon.FitAddon() : undefined;
  if (addon) terminal.loadAddon?.(addon);
  terminal.open(node);
  terminal.focus?.();
  addon?.fit?.();

  const config = await staticBrowserConfig();
  const query = new URL(location.href).searchParams;
  const sharedFs = query.get("shared-fs") ?? config.storage.shared.url;
  if (!sharedFs) {
    throw new Error("NERU requires a common authoritative mikuOS filesystem endpoint");
  }
  const sharedFsToken = query.get("shared-fs-token") ?? config.storage.shared.token;

  if (status) status.textContent = "Starting mikuOS through NERU/Linux…";
  const machine = await bootNeruBrowser({
    base: new URL("./neru/", document.baseURI),
    sharedFs: new URL(sharedFs, document.baseURI),
    ...(sharedFsToken ? { sharedFsToken } : {}),
    write: text => terminal.write(text),
    log: message => console.debug(`NERU: ${message}`),
  });
  const data = terminal.onData(value => machine.keyInput(value));
  const fit = () => addon?.fit?.();
  window.addEventListener("resize", fit);
  fit();

  document.documentElement.dataset.kernel = "neru";
  if (status) status.textContent = "NERU Linux active · shared mikuOS userspace mounted";

  globals.MikuOS = {
    kernel: "neru",
    persistent: true,
    sharedUserspace: sharedFs,
    dispose(): void {
      data.dispose();
      window.removeEventListener("resize", fit);
      machine.terminate();
      addon?.dispose?.();
      terminal.dispose?.();
    },
  };
};

void launch().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  const status = document.querySelector<HTMLElement>("#runtime-status");
  if (status) status.textContent = `NERU failed: ${message}`;
  console.error(error);
});
