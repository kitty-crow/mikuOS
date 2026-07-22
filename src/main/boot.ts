import { Kern } from "../core/kernel.js";
import { Sys } from "../core/sys.js";
import { Tty } from "../io/tty.js";
import { Shell, ShExit } from "../sh/shell.js";
import { image, live, migrateImage, ROOT_IMAGE_VERSION } from "./image.js";
import { norm } from "../fs/vfs.js";
import { Net } from "../net/net.js";
import { treeFs } from "../fs/tree.js";
import type { Tree } from "../fs/tree.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import type { AccountConfig, SystemConfig } from "../core/config.js";
import type { TetoImageProvider } from "../teto/loader.js";
import { validateTetoProvider } from "../teto/provider.js";
import type { KernelMode } from "../teto/provider.js";

export type Ch = "out" | "err" | "sys" | "in";

export interface Host {
  put(s: string, ch: Ch): void | Promise<void>;
  halt?(): void;
  tree?: Tree;
  pkg?: { install(kernel: Kern): Promise<boolean> };
  config?: SystemConfig;
  account?: AccountConfig;
  setId?: boolean;
  teto?: TetoImageProvider;
  kernelMode?: KernelMode;
}

export class Os {
  readonly k;
  readonly p;
  readonly s;
  readonly sh;
  readonly tty;
  readonly ready: Promise<void>;
  busy = false;
  activeKernelMode: "thistle" | "teto" = "thistle";
  private save = Promise.resolve();

  constructor(readonly host: Host, net = new Net()) {
    const config = host.config ?? DEFAULT_CONFIG;
    this.k = new Kern(net, undefined, config, host.setId ?? false, host.teto);
    this.k.ttyFn = (x, e) => void host.put(x, e ? "err" : "out");
    image(this.k);
    this.tty = new Tty(
      (x, e) => host.put(x, e ? "err" : "out"),
      n => n === 2 ? this.sh?.interrupt() ?? false : false,
    );
    this.p = this.k.session({ sin: this.tty.input, sout: this.tty.output, serr: this.tty.error }, host.account ?? config.accounts.cli);
    this.s = new Sys(this.k, this.p);
    this.sh = new Shell(this.s);
    this.k.setHalt(() => host.halt?.());
    this.k.log("thsh: interactive session ready");
    this.ready = this.init();
  }

  async hello(): Promise<void> {
    await this.ready;
    if (this.activeKernelMode === "teto") {
      const banner = this.k.config.messages.tetoBanner;

      if (banner) {
        await this.host.put(
          `${banner}${banner.endsWith("\n") ? "" : "\n"}`,
          "sys",
        );
      }
    }
    if (!this.sh.prefs.showWelcome) return;
    try {
      const kernelSource = this.activeKernelMode === "teto"
        ? "Teto"
        : "Thistle";
      const motd = this.s.read("/etc/motd").replace(
        /Kernel source: (?:Thistle|Teto)\./,
        `Kernel source: ${kernelSource}.`,
      );
      await this.host.put(motd, "sys");
    }
    catch { /* A deleted motd should not brick the login. */ }
  }

  async run(
    line: string,
    heredocBodies: readonly string[] = [],
    recordHistory = true,
  ): Promise<number> {
    await this.ready;
    this.busy = true;
    try {
      return await this.sh.run(line, recordHistory, heredocBodies);
    }
    catch (e) { if (e instanceof ShExit) { this.host.halt?.(); return e.code; } throw e; }
    finally {
      this.busy = false;
      this.tty.reset();
      await this.flush();
    }
  }

  input(s: string | Uint8Array): void { this.tty.feed(s); }
  resize(rows: number, cols: number): void { this.tty.resize(rows, cols); }
  prompt(): string { return this.sh.prompt(); }
  interrupt(): void { this.sh.interrupt(); }
  complete(line: string): { line: string; list: string[] } { return this.sh.complete(line); }

  load(name: string, b: Uint8Array, mode = 0o755): string {
    const safe = name.replace(/[^A-Za-z0-9._+-]/g, "_") || "module.wasm";
    const p = norm(`/tmp/${safe}`);
    try { this.s.writeb(p, b); } catch { this.s.mkfile(p, b, mode); }
    this.s.chmod(p, mode);
    return p;
  }

  async flush(): Promise<void> {
    if (!this.host.tree) return;
    const ent = this.snapshot();
    this.save = this.save.then(async () => {
      const merged = await this.host.tree!.push(ent, ROOT_IMAGE_VERSION);
      if (merged) {
        treeFs.load(this.k.fs, merged);
        live(this.k);
      }
    }).catch(async e => {
      this.k.log(`persist: save failed: ${e instanceof Error ? e.message : String(e)}`);
      await this.host.put(`Persistence save failed: ${e instanceof Error ? e.message : String(e)}\n`, "err");
    });
    await this.save;
  }

  private async restore(): Promise<void> {
    if (!this.host.tree) { live(this.k); return; }
    try {
      const ent = await this.host.tree.pull();
      const before = this.host.tree.imageVersion ?? 0;
      if (ent) treeFs.load(this.k.fs, ent);
      this.k.disk = true;
      const after = ent ? migrateImage(this.k, before) : ROOT_IMAGE_VERSION;
      live(this.k);
      if (ent) {
        if (after !== before) await this.host.tree.push(this.snapshot(), after);
        this.k.log(`hostfs: restored / from ${ent.length} entries in ${this.host.tree.label}`);
      } else {
        await this.host.tree.push(this.snapshot(), after);
        this.k.log(`hostfs: initialized / in ${this.host.tree.label}`);
      }
    } catch (e) {
      this.k.disk = false;
      live(this.k);
      this.k.log(`persist: restore failed: ${e instanceof Error ? e.message : String(e)}`);
      await this.host.put(`Persistent root was not mounted: ${e instanceof Error ? e.message : String(e)}\n`, "err");
    }
  }


  private async configureKernelMode(): Promise<void> {
    const requested = this.host.kernelMode ?? "thistle";
    if (requested === "thistle") {
      this.activeKernelMode = "thistle";
      this.k.name = "Thistle";
      this.p.env.set("MIKUOS_KERNEL_MODE", "thistle");
      this.p.env.delete("THISTLE_RV_CORE");
      this.p.env.delete("THISTLE_TETO_STRICT");
      this.k.executionCore = "Thistle TypeScript";
      return;
    }
    if (!this.host.teto) {
      if (requested === "teto") throw new Error("Teto was requested but this host did not provide teto.wasm");
      this.k.log("teto: unavailable; auto mode retained direct Thistle execution");
      this.activeKernelMode = "thistle";
      this.k.name = "Thistle";
      this.p.env.set("MIKUOS_KERNEL_MODE", "thistle");
      return;
    }
    try {
      await validateTetoProvider(this.host.teto);
      this.activeKernelMode = "teto";
      this.k.name = "Teto";
      this.p.env.set("MIKUOS_KERNEL_MODE", "teto");
      this.p.env.set("THISTLE_RV_CORE", "teto-wasm-core");
      // The current migration still delegates syscalls not yet owned by Teto.
      this.p.env.set("THISTLE_TETO_STRICT", "0");
      this.k.executionCore = "Teto WebAssembly";
      this.k.log("teto: generated WebAssembly RV64 execution core validated and selected");
    } catch (error) {
      if (requested === "teto") throw error;
      this.activeKernelMode = "thistle";
      this.p.env.set("MIKUOS_KERNEL_MODE", "thistle");
      this.p.env.delete("THISTLE_RV_CORE");
      this.p.env.delete("THISTLE_TETO_STRICT");
      this.k.executionCore = "Thistle TypeScript";
      this.k.log(`teto: startup validation failed; auto mode fell back to Thistle: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async init(): Promise<void> {
    await this.restore();
    await this.configureKernelMode();
    this.sh.ensureUserState(true);
    if (this.host.pkg) {
      try {
        if (await this.host.pkg.install(this.k)) {
          live(this.k);
          await this.flush();
        }
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        const message = error instanceof Error && error.message
          ? error.message
          : `${error instanceof Error ? error.name : "Error"}${code ? ` (${String(code)})` : ""}`;
        this.k.log(`pkg: install failed: ${message}`);
        await this.host.put(`Optional root package was not installed: ${message}\n`, "err");
      }
    }
  }

  private snapshot(): ReturnType<typeof treeFs.dump> {
    return treeFs.dump(this.k.fs).filter(entry =>
      !["/dev", "/proc"].some(path => entry.p === path || entry.p.startsWith(`${path}/`)),
    );
  }
}

export const boot = (host: Host, net?: Net): Os => new Os(host, net);
