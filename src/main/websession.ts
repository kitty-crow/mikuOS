import { boot } from "./boot.js";
import type { Host, Os } from "./boot.js";
import type { SystemConfig } from "../core/config.js";
import type { Tree } from "../fs/tree.js";
import { Net, FetchDev } from "../net/net.js";
import { LineEditor } from "../sh/editor.js";
import type { TetoImageProvider } from "../teto/loader.js";
import type { KernelMode } from "../teto/provider.js";

export interface WebSessionOutput {
  write(text: string): void;
  halt?(): void;
}

export interface WebSessionOptions {
  config: SystemConfig;
  tree?: Tree;
  net?: Net;
  kernelMode?: KernelMode;
  teto?: TetoImageProvider;
}

/** A complete kernel, guest session, and line editor running in this process. */
export class WebSession {
  readonly os: Os;
  readonly ready: Promise<void>;
  private readonly editor: LineEditor;
  private chain = Promise.resolve();
  private live = true;

  constructor(
    private readonly output: WebSessionOutput,
    options: WebSessionOptions,
  ) {
    const host: Host = {
      put: text => output.write(text),
      halt: () => this.halt(),
      config: options.config,
      account: options.config.accounts.web,
      setId: true,
      kernelMode: options.kernelMode ?? "thistle",
      ...(options.teto ? { teto: options.teto } : {}),
    };

    if (options.tree) host.tree = options.tree;

    this.os = boot(
      host,
      options.net ?? new Net(new FetchDev()),
    );
    this.editor = new LineEditor({
      shell: this.os.sh,
      prompt: () => this.os.prompt(),
      busy: () => this.os.busy,
      write: text => output.write(text),
      execute: (source, bodies) => this.execute(source, bodies),
      passthrough: data => this.os.input(data),
      halt: () => this.halt(),
      complete: line => this.os.complete(line),
    });
    this.ready = this.start();
  }

  key(data: string): void {
    if (this.live) this.editor.key(data);
  }

  resize(rows: number, columns: number): void {
    this.os.resize(
      Math.max(1, Math.trunc(rows)),
      Math.max(1, Math.trunc(columns)),
    );
  }

  async idle(): Promise<void> {
    await this.ready;
    await this.chain;
  }

  private async start(): Promise<void> {
    await this.os.ready;
    await this.os.hello();
    this.os.sh.ensureUserState(true);
    this.editor.afterCommand();
  }

  private execute(source: string, bodies: readonly string[]): void {
    this.chain = this.chain.then(async () => {
      if (!this.live) return;
      await this.os.run(source, bodies);
      this.editor.afterCommand();
    }).catch(error => {
      this.output.write(
        `${error instanceof Error ? error.message : String(error)}\r\n`,
      );
      this.editor.afterCommand();
    });
  }

  private halt(): void {
    if (!this.live) return;
    this.live = false;
    this.output.write(this.os.k.config.messages.halted);
    this.output.halt?.();
  }
}
