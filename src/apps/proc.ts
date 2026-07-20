import { App } from "./base.js";
import type { Sys } from "../core/sys.js";
import type { Sig } from "../core/proc.js";
import { bad } from "../core/err.js";
import { narg } from "./util.js";

export class Ps extends App {
  constructor() { super("ps", "Report live kernel processes.", "ps [-ef]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const all = a.some(x => x.includes("e") || x.includes("f"));
    await s.out("  PID  PPID  PGID UID STAT    TIME COMMAND\n");
    for (const p of s.ps()) if (all || p.ppid === s.pid || p.pid === s.pid) {
      const t = `${Math.floor(p.ms / 60000)}:${String(Math.floor(p.ms / 1000) % 60).padStart(2, "0")}`;
      await s.out(`${String(p.pid).padStart(5)} ${String(p.ppid).padStart(5)} ${String(p.pgid).padStart(5)} ${String(p.uid).padStart(3)} ${p.state.padEnd(6)} ${t.padStart(5)} ${p.cmd}\n`);
    }
    return 0;
  }
}

export class Kill extends App {
  constructor() { super("kill", "Send a signal to a process or process group.", "kill [-SIGNAL] pid ..."); }
  override async run(s: Sys, a: string[]): Promise<number> {
    let sig: Sig = 15;
    if (a[0]?.startsWith("-S")) { const x = a.shift()!.slice(1); sig = x === "SIGKILL" ? 9 : x === "SIGINT" ? 2 : x === "SIGPIPE" ? 13 : x === "SIGHUP" ? 1 : 15; }
    else if (/^-(1|2|9|13|15)$/.test(a[0] ?? "")) sig = Number(a.shift()!.slice(1)) as Sig;
    if (!a.length) bad("EINVAL", "kill: missing pid");
    for (const p of a) s.kill(Math.trunc(narg(p, "pid")), sig);
    return 0;
  }
}

export class Sleep extends App {
  constructor() { super("sleep", "Pause for a duration.", "sleep number[s|m|h]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    const x = a[0] ?? bad("EINVAL", "sleep: duration required");
    const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(x);
    if (!m) return bad("EINVAL", x);
    const k = m[2] === "ms" ? 1 : m[2] === "m" ? 60000 : m[2] === "h" ? 3600000 : 1000;
    await s.sleep(Number(m[1]) * k);
    return 0;
  }
}

export class Time extends App {
  constructor() { super("time", "Run a command and report elapsed time.", "time command [arg ...]"); }
  override async run(s: Sys, a: string[]): Promise<number> {
    if (!a.length) bad("EINVAL", "time: command required");
    const t = performance.now();
    const p = s.start(a[0]!, a.slice(1));
    const n = await s.wait(p.pid);
    await s.err(`\nreal\t${((performance.now() - t) / 1000).toFixed(3)}s\n`);
    return n;
  }
}
