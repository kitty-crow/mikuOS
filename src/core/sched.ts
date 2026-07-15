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
    // Big compilers can run for a while. Let paint and network breathe now and then.
    await new Promise<void>(ok => this.ticks % 64 ? queueMicrotask(ok) : setTimeout(ok, 0));
    this.ready.splice(this.ready.indexOf(p.pid), 1);
    this.ticks++;
    if (p.code === null) p.state = "run";
  }
}
