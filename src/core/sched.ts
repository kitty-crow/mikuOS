import type { Proc } from "./proc.js";

export class Sched {
  readonly ready: number[] = [];
  ticks = 0;

  add(p: Proc, fn: () => Promise<void>): void {
    p.state = "ready";
    this.ready.push(p.pid);
    queueMicrotask(() => {
      const i = this.ready.indexOf(p.pid);
      if (i >= 0) this.ready.splice(i, 1);
      this.ticks++;
      void fn();
    });
  }

  async yield(p: Proc): Promise<void> {
    p.state = "ready";
    this.ready.push(p.pid);
    await new Promise<void>(ok => queueMicrotask(ok));
    this.ready.splice(this.ready.indexOf(p.pid), 1);
    this.ticks++;
    if (p.code === null) p.state = "run";
  }
}
