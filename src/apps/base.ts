import type { Sys } from "../core/sys.js";

export abstract class App {
  constructor(
    public readonly name: string,
    public readonly desc: string,
    public readonly use = name,
  ) {}

  abstract run(s: Sys, a: string[]): Promise<number>;

  async help(s: Sys): Promise<number> {
    await s.out(`usage: ${this.use}\n${this.desc}\n`);
    return 0;
  }
}

export class FnApp extends App {
  constructor(
    name: string,
    desc: string,
    use: string,
    private readonly fn: (s: Sys, a: string[]) => number | Promise<number>,
  ) { super(name, desc, use); }

  override async run(s: Sys, a: string[]): Promise<number> { return this.fn(s, a); }
}
