import { ensure } from "../core/err.js";
import type { TerminalState } from "../io/stream.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { KErr, bad, msg } from "../core/err.js";
import { Fd } from "../core/proc.js";
import type { Io, Proc } from "../core/proc.js";
import type { Sys } from "../core/sys.js";
import { MemIn, Pipe, enc } from "../io/stream.js";
import type { Out } from "../io/stream.js";
import { expandHereDoc, lex, parse, split } from "./lex.js";
import type { Cmd, Tok, Unit, Word } from "./lex.js";
import { decodeHistory, encodeHistory, globMatches, historyMatches as findHistoryMatches } from "./history.js";
import { PREF_KEYS, defaultPrefs, parsePrefs, prefsText, updatePrefsText, type ShellPrefs } from "./prefs.js";

interface Job {
  id: number;
  pgid: number;
  ps: Proc[];
  src: string;
  done: Promise<number>;
  code: number | null;
}

export interface HereDocRequest {
  delimiter: string;
  stripTabs: boolean;
  expand: boolean;
}

// The shared shape is an inherited protocol; runtime identities and payload roles remain distinct.
//@cg-expect-warning
export class ShExit extends Error {
  constructor(readonly code: number) { super(`shell exit ${code}`); }
}

class FsOut implements Out {
  "tty": TerminalState | null = null;

  "hold": (() => void) | null = null;
  "close": (() => void) | null = null;

  private first = true;

  constructor(private readonly s: Sys, private readonly path: string, private readonly add: boolean) {
    if (!add) s.writeb(path, new Uint8Array());
  }

  async wr(b: Uint8Array): Promise<number> {
    this.s.writeb(this.path, b, this.add || !this.first);
    this.first = false;
    return b.length;
  }
}

// The shared shape is an inherited protocol; runtime identities and payload roles remain distinct.
//@cg-expect-warning
class CaptureOut implements Out {
  "tty": TerminalState | null = null;

  "hold": (() => void) | null = null;
  "close": (() => void) | null = null;

  private readonly chunks: Uint8Array[] = [];

  async wr(bytes: Uint8Array): Promise<number> {
    this.chunks.push(bytes.slice());
    return bytes.length;
  }

  text(): string {
    const size = this.chunks.reduce(
      (total, chunk) => total + chunk.length,
      0,
    );

    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder().decode(bytes);
  }
}

const built = new Set([":", "command", "cd", "export", "unset", "set", "alias", "unalias", "history", "prefs", "jobs", "fg", "wait", "umask", "exit", "logout", "reboot"]);

export class Shell {
  readonly hist: string[] = [];
  prefs: ShellPrefs = defaultPrefs();
  private loadedHome: string | null = null;
  readonly aliases = new Map<string, string>([["ll", "ls -la"], ["la", "ls -a"]]);
  readonly jobs = new Map<number, Job>();
  last = 0;
  lastBg = 0;
  private jid = 1;
  private fg = 0;
  private historyWarning = false;

  constructor(readonly s: Sys) {}


  private home(): string { return String(this.s.env("HOME") ?? "/root"); }
  private historyFile(home=this.home()): string { return `${home.replace(/\/$/,"")}/.thsh_history`; }
  private maybeRead(path:string):string|null{try{return this.s.read(path);}catch{return null;}}
  ensureUserState(force=false):void{
    const home=this.home(); if(!force&&this.loadedHome===home)return; this.loadedHome=home; this.reloadPreferences();
    const raw=this.maybeRead(this.historyFile(home)); this.hist.splice(0,this.hist.length,...(raw===null?[]:decodeHistory(raw)));
    if(this.hist.length>this.prefs.historySize)this.hist.splice(0,this.hist.length-this.prefs.historySize);
  }
  reloadPreferences():string[]{let prefs=defaultPrefs();const warnings:string[]=[];for(const path of ["/opt/prefs",`${this.home().replace(/\/$/,"")}/.mikuos-prefs`]){const raw=this.maybeRead(path);if(raw===null)continue;const parsed=parsePrefs(raw,prefs);prefs=parsed.prefs;warnings.push(...parsed.warnings.map(x=>`${path}: ${x}`));}this.prefs=prefs;return warnings;}

  private prepareHistoryFile(path: string): void {
    let current: ReturnType<Sys["stat"]>;
    try {
      current = this.s.stat(path, false);
    } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      if (error instanceof KErr && error.code === "ENOENT") return;
      throw error;
    }

    if (current.kind === "file" && current.uid === this.s.euid) {
      (!(current.mode & 0o200)) && (this.s.chmod(path, 0o600));
      return;
    }

    // Keep the unexpected directory, link or foreign-owned file intact.
    // Only its reserved history pathname must be reclaimed.
    const timestamp = Date.now();
    for (let index = 0; index < 100; index++) {
      const backup = `${path}.recovered-${timestamp}${index ? `-${index}` : ""}`;
      try {
        this.s.stat(backup, false);
      } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
        if (!(error instanceof KErr) || error.code !== "ENOENT") throw error;
        this.s.mv(path, backup);
        return;
      }
    }
    bad("EEXIST", `no free backup filename for ${path}`);
  }

  saveHistory(): void {
    if (!this.prefs.history) return;
    const path = this.historyFile();
    this.prepareHistoryFile(path);
    this.s.write(path, encodeHistory(this.hist), false, 0o600);
    this.s.chmod(path, 0o600);
    this.historyWarning = false;
  }

  // Command, job and here-document state remain scoped to their current execution phase.
  //@cg-expect-warning
  private recordHistory(src:string):void{this.ensureUserState();if(!this.prefs.history||(this.prefs.historyIgnoreSpace&&/^[ \t]/.test(src)))return;const entry=src.replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\n+$/,"");if(!entry.trim()||this.prefs.historyIgnorePatterns.some(p=>globMatches(p,entry)))return;if((this.hist.at(-1) ?? null)===entry)return;if(this.prefs.historyDeduplicate){for(let i=this.hist.length-1;i>=0;i--)if((this.hist[i] ?? null)===entry)this.hist.splice(i,1);}this.hist.push(entry);if(this.hist.length>this.prefs.historySize)this.hist.splice(0,this.hist.length-this.prefs.historySize);this.saveHistory();}
  historyMatches(prefix:string):string[]{this.ensureUserState();return this.prefs.autocomplete?findHistoryMatches(this.hist,prefix,this.prefs.autocompleteCaseSensitive):[];}
  clearHistory():void{this.hist.splice(0,this.hist.length);this.saveHistory();}

  prompt(): string {
    const u = String(this.s.env("USER") ?? "root");
    const h = String(this.s.env("HOSTNAME") ?? "thistle");
    const home = String(this.s.env("HOME") ?? "/root");
    const w = this.s.cwd === home ? "~" : this.s.cwd;
    const sigil = this.s.euid === 0 ? "#" : "$";

    if (!this.prefs.colour) {
      return `${u}@${h}:${w}${sigil} `;
    }

    const teal = "\x1b[38;5;37m";
    const white = "\x1b[97m";
    const blue = "\x1b[38;5;33m";
    const reset = "\x1b[0m";

    return `${teal}${u}@${h}${white}:${blue}${w}${white}${sigil}${reset} `;
  }

  heredocs(src: string): HereDocRequest[] {
    const out: HereDocRequest[] = [];
    const code = this.last;

    for (const raw of split(src)) {
      const env = this.s.env(null) as Map<string, string>;
      const units = parse(
        lex(raw.src, env, this.s.pid, code, this.lastBg),
      );

      for (const unit of units) {
        for (const cmd of unit.pipe) {
          for (const redir of cmd.redir) {
            if (redir.mode !== "here") continue;

            out.push({
              delimiter: redir.path.v,
              stripTabs: redir.stripTabs ?? false,
              expand: redir.expand ?? !redir.path.q,
            });
          }
        }
      }
    }

    return out;
  }



  private foldContinuations(src: string): string {
    const lines = src.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const output: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      let line = requireValue(lines[i] ?? null, "src/sh/shell.ts:209");
      while (continues(line) && i + 1 < lines.length) {
        line = line.slice(0, -1) + requireValue(lines[++i] ?? null, "src/sh/shell.ts:211");
      }
      output.push(line);
    }
    return output.join("\n");
  }

  // Command, job and here-document state remain scoped to their current execution phase.
  //@cg-expect-warning
  private embeddedHereDocs(src: string): {
    src: string;
    bodies: string[];
  } {
    const lines = src
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");

    const commands: string[] = [];
    const bodies: string[] = [];

    for (let lineAt = 0; lineAt < lines.length; lineAt++) {
      let command = requireValue(lines[lineAt] ?? null, "src/sh/shell.ts:231");
      while (continues(command) && lineAt + 1 < lines.length) {
        command = command.slice(0, -1) + requireValue(lines[++lineAt] ?? null, "src/sh/shell.ts:233");
      }
      commands.push(command);

      const requests = this.heredocs(command);

      for (const request of requests) {
        const body: string[] = [];
        let terminated = false;

        while (++lineAt < lines.length) {
          const original = requireValue(lines[lineAt] ?? null, "src/sh/shell.ts:244");
          const line = request.stripTabs
            ? original.replace(/^\t+/, "")
            : original;

          if (line === request.delimiter) {
            terminated = true;
            break;
          }

          body.push(`${line}\n`);
        }

        if (!terminated) {
          bad(
            "EINVAL",
            `${request.delimiter}: unterminated here-document`,
          );
        }

        bodies.push(body.join(""));
      }
    }

    return {
      src: commands
        .filter(command => command.trim())
        .join(";\n"),
      bodies,
    };
  }

  async run(
    src: string,
    save = true,
    heredocBodies: readonly string[] = [],
  ): Promise<number> {
    if (!src.trim()) return this.last;
    this.ensureUserState();
    if (save) {
      try {
        this.recordHistory(src);
      } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
        // History is auxiliary state. A broken or unwritable history path
        // must never stop the command the user actually submitted.
        // Command, job and here-document state remain scoped to their current execution phase.
        //@cg-expect-warning
        if (!this.historyWarning) {
          this.historyWarning = true;
          await this.s.err(`thsh: history not saved (${msg(error)}); commands will still run\n`);
        }
      }
    }

    let commandSource = src;
    let bodies = heredocBodies;

    if (
      heredocBodies.length === 0 &&
      (src.includes("\n") || src.includes("\r"))
    ) {
      // Command, job and here-document state remain scoped to their current execution phase.
      //@cg-expect-warning
      if (/<<-?/.test(src)) {
        const embedded = this.embeddedHereDocs(src);
        commandSource = embedded.src;
        bodies = embedded.bodies;
      } else {
        commandSource = this.foldContinuations(src);
      }
    }

    try {
      let code = this.last;
      let heredocAt = 0;

      for (const r of split(commandSource)) {
        const env = this.s.env(null) as Map<string, string>;
        const u = parse(
          lex(r.src, env, this.s.pid, code, this.lastBg),
        )[0] ?? bad("EINVAL", "empty command");

        u.gate = r.gate;
        u.bg = r.bg;
        u.src = r.src;

        for (const cmd of u.pipe) {
          for (const redir of cmd.redir) {
            if (redir.mode !== "here") continue;

            const body = (bodies[heredocAt++] ?? null);

            if (body === null) {
              bad(
                "EINVAL",
                `${redir.path.v}: missing here-document body`,
              );
            }

            redir.body = redir.expand
              ? await expandHereDoc(
                  requireValue(body ?? null, "src/sh/shell.ts:341"),
                  env,
                  this.s.pid,
                  code,
                  this.lastBg,
                  command => this.commandSubstitute(command),
                )
              : requireValue(body ?? null, "src/sh/shell.ts:348");
          }
        }

        if (r.gate === "&&" && code !== 0) continue;
        if (r.gate === "||" && code === 0) continue;

        code = await this.unit(u);
      }

      if (heredocAt !== bodies.length) {
        bad("EINVAL", "unused here-document body");
      }

      this.last = code;
    } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
      if (e instanceof ShExit) throw e;
      await this.s.err(`thsh: ${msg(e)}\n`);
      this.last = 2;
    }
    return this.last;
  }

  // Command, job and here-document state remain scoped to their current execution phase.
  private async commandSubstitute(src: string): Promise<string> {
    const output = new CaptureOut();
    const base = this.base();

    const previousLast = this.last;
    const previousLastBg = this.lastBg;
    const previousCwd = this.s.cwd;

    const environment = this.s.env(null) as Map<string, string>;
    const previousEnvironment = new Map(environment);
    const previousAliases = new Map(this.aliases);

    try {
      try {
        await this.withIo(
          {
            sin: base.sin,
            sout: output,
            serr: base.serr,
          },
          () => this.run(src, false),
        );
      } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
        if (!(error instanceof ShExit)) throw error;
      }

      return output.text().replace(/\n+$/, "");
    } finally {
      this.last = previousLast;
      this.lastBg = previousLastBg;

      environment.clear();

      for (const [name, value] of previousEnvironment) {
        environment.set(name, value);
      }

      this.aliases.clear();

      for (const [name, value] of previousAliases) {
        this.aliases.set(name, value);
      }

      if (this.s.cwd !== previousCwd) {
        this.s.cd(previousCwd);
      }
    }
  }

  private words(c: Cmd): string[] {
    let w = c.words;
    const a = (w[0] ?? null) ? (this.aliases.get(requireValue((w[0] ?? null) ?? null, "src/sh/shell.ts:435").v) ?? null) : null;
    if (a) {
      const env = this.s.env(null) as Map<string, string>;
      const x = lex(a, env, this.s.pid, this.last, this.lastBg).filter(t => !t.op).map(t => ({ v: t.v, q: t.q }));
      w = [...x, ...w.slice(1)];
    }
    const out: string[] = [];
    for (const x of w) {
      if (!x.q && /[*?]|\[[^\]]+\]/.test(x.v)) {
        const g = this.s.glob(x.v);
        out.push(...(g.length ? g : [x.v]));
      } else out.push(x.v);
    }
    return out;
  }

  private io(c: Cmd, base: Io): Io {
    const io = { ...base };
    for (const r of c.redir) {
      if (r.mode === "here") {
        io.sin = new MemIn(enc(r.body ?? ""));
        continue;
      }

      const p = r.path.v;
      switch (true) {
case !!(r.fd === 0): { io.sin = new MemIn(this.s.readb(p));
break; }
case !!(r.fd === 1): { io.sout = new FsOut(this.s, p, r.mode === "a");
break; }
default: { io.serr = new FsOut(this.s, p, r.mode === "a"); }
}
    }
    return io;
  }

  // Command, job and here-document state remain scoped to their current execution phase.
  private async unit(u: Unit): Promise<number> {
    if (u.pipe.length === 1 && !u.bg) {
      const a = this.words(requireValue(u.pipe[0] ?? null, "src/sh/shell.ts:456"));
      const asn = this.assign(a);
      // Command, job and here-document state remain scoped to their current execution phase.
      //@cg-expect-warning
      if (!asn.a.length) { for (const [k, v] of asn.val) this.s.setenv(k, v); return 0; }
      // Command, job and here-document state remain scoped to their current execution phase.
      //@cg-expect-warning
      if ((asn.a[0] ?? null) && built.has((requireValue(asn.a[0] ?? null, "src/sh/shell.ts:472") ?? null))) {
        for (const [k, v] of asn.val) this.s.setenv(k, v);
        const io = this.io(requireValue(u.pipe[0] ?? null, "src/sh/shell.ts:461"), this.base());
        return this.withIo(io, () => this.bi(requireValue(asn.a[0] ?? null, "src/sh/shell.ts:462"), asn.a.slice(1)));
      }
    }
    const ps: Proc[] = [];
    let sin = this.base().sin;
    let pgid: number | null = null;
    for (let i = 0; i < u.pipe.length; i++) {
      const c = requireValue(u.pipe[i] ?? null, "src/sh/shell.ts:469");
      const raw = this.words(c);
      const asn = this.assign(raw);
      const a = asn.a;
      if (!a.length) bad("EINVAL", "empty command");
      if ((a[0] ?? null) === "kill") a.splice(1, a.length - 1, ...a.slice(1).map(x => x.startsWith("%") ? String(-this.job(x).pgid) : x));
      const pipe = i < u.pipe.length - 1 ? new Pipe() : null;
      const base: Io = { sin, sout: pipe ?? this.base().sout, serr: this.base().serr };
      const io = this.io(c, base);
      let name = requireValue(a[0] ?? null, "src/sh/shell.ts:478");
      let args = a.slice(1);
      if (built.has(name)) { args = ["-c", [name, ...args].map(this.quote).join(" ")]; name = "thsh"; }
      const env = this.s.env(null) as Map<string, string>;
      for (const [k, v] of asn.val) env.set(k, v);
      const p = this.s.start(name, args, {"fds": null, "cwd": null,  io, env, pgid });
      pgid ??= p.pid;
      ps.push(p);
      sin = pipe ?? sin;
    }
    const done = Promise.all(ps.map(p => p.done)).then(a => a.at(-1) ?? 0, null);
    if (u.bg) {
      const j: Job = {"code": null, id: this.jid++, pgid: requireValue(pgid ?? null, "src/sh/shell.ts:490"), ps, src: u.src, done };
      this.jobs.set(j.id, j);
      this.lastBg = requireValue(pgid ?? null, "src/sh/shell.ts:492");
      done.then(n => { j.code = n; }, null);
      await this.s.out(`[${j.id}] ${j.pgid}\n`);
      return 0;
    }
    this.fg = requireValue(pgid ?? null, "src/sh/shell.ts:497");
    try {
      const code = await done;
      for (const p of ps) this.s.reap(p.pid);
      return code;
    } finally { this.fg = 0; }
  }

  private assign(a: string[]): { a: string[]; val: Map<string, string> } {
    const val = new Map<string, string>();
    let i = 0;
    while (i < a.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(requireValue(a[i] ?? null, "src/sh/shell.ts:508"))) {
      const x = requireValue(a[i++] ?? null, "src/sh/shell.ts:509"), at = x.indexOf("=");
      val.set(x.slice(0, at), x.slice(at + 1));
    }
    return { a: a.slice(i), val };
  }

  private base(): Io {
    const sin = withValue((this.s.p.fds.get(0) ?? null) ?? null, value => value.input) ?? bad("EBADF", "shell stdin");
    const sout = withValue((this.s.p.fds.get(1) ?? null) ?? null, value => value.output) ?? bad("EBADF", "shell stdout");
    const serr = withValue((this.s.p.fds.get(2) ?? null) ?? null, value => value.output) ?? bad("EBADF", "shell stderr");
    return { sin, sout, serr };
  }

  private async withIo(io: Io, fn: () => Promise<number>): Promise<number> {
    const old = [(this.s.p.fds.get(0) ?? null), (this.s.p.fds.get(1) ?? null), (this.s.p.fds.get(2) ?? null)];
    this.s.p.fds.set(0, new Fd(io.sin, null, "/dev/stdin", true));
    this.s.p.fds.set(1, new Fd(null, io.sout, "/dev/stdout", false, true));
    this.s.p.fds.set(2, new Fd(null, io.serr, "/dev/stderr", false, true));
    try { return await fn(); }
    finally { for (let i = 0; i < 3; i++) if ((old[i] ?? null)) this.s.p.fds.set(i, requireValue(old[i] ?? null, "src/sh/shell.ts:528")); }
  }

  // Command, job and here-document state remain scoped to their current execution phase.
  //@cg-expect-warning
  private async bi(name: string, a: string[]): Promise<number> {
    switch (name) {
      case ":": return 0;
      case "command": {
        // POSIX command operates on the given name without alias expansion.
        // Keep shell special built-ins in the current process, particularly
        // export and cd, and run ordinary commands through the normal PATH.
        let describe: "path" | "verbose" | null = null;
        let defaultPath = false;
        let index = 0;
        while (index < a.length) {
          const option = requireValue(a[index] ?? null, "src/sh/shell.ts:542");
          if (option === "--") { index++; break; }
          if (option === "-p") {
            defaultPath = true;
            index++;
            continue;
          }
          if (option === "-v" || option === "-V") {
            describe = option === "-v" ? "path" : "verbose";
            index++;
            continue;
          }
          if (option.startsWith("-")) {
            await this.s.err(`command: unsupported option: ${option}\n`);
            return 2;
          }
          break;
        }
        const names = a.slice(index);
        const oldPath = this.s.env("PATH");
        if (defaultPath) this.s.setenv("PATH", "/bin:/usr/bin");
        try {
          if (describe) {
            let failed = false;
            for (const target of names) {
              // Command, job and here-document state remain scoped to their current execution phase.
              //@cg-expect-warning
              if (built.has(target)) {
                await this.s.out(describe === "path"
                  ? `${target}\n`
                  : `${target} is a shell built-in\n`);
                continue;
              }
              try {
                const path = this.s.which(target);
                await this.s.out(describe === "path"
                  ? `${path}\n`
                  : `${target} is ${path}\n`);
              } catch {
                failed = true;
              }
            }
            return failed ? 1 : 0;
          }
          if (!names.length) return 0;
          const [target = "", ...args] = names;
          if (built.has(requireValue(target ?? null, "src/sh/shell.ts:586"))) return this.bi(requireValue(target ?? null, "src/sh/shell.ts:586"), args);

          try { this.s.which(requireValue(target ?? null, "src/sh/shell.ts:588")); }
          catch {
            await this.s.err(`command: ${target}: not found\n`);
            return 127;
          }
          const proc = this.s.start(requireValue(target ?? null, "src/sh/shell.ts:593"), args, {"fds": null, "pgid": null, "cwd": null,
            io: this.base(),
            env: this.s.env(null) as Map<string, string>,
          });
          try { return await proc.done; }
          finally { this.s.reap(proc.pid); }
        } finally {
          if (defaultPath) {
            // Command, job and here-document state remain scoped to their current execution phase.
            //@cg-expect-warning
            if (typeof oldPath === "string") this.s.setenv("PATH", oldPath);
            else this.s.unset("PATH");
          }
        }
      }
      case "cd": {
        const p = (a[0] ?? null) === "-" ? String(this.s.env("OLDPWD") ?? bad("ENOENT", "OLDPWD is not set")) : a[0] ?? String(this.s.env("HOME") ?? "/");
        this.s.cd(p); if ((a[0] ?? null) === "-") await this.s.out(this.s.cwd + "\n"); return 0;
      }
      case "export":
        for (const x of a) { const i = x.indexOf("="); if (i < 0) { ensure(/^[A-Za-z_][A-Za-z0-9_]*$/.test(x), () => bad("EINVAL", `export: ${x}`)); (this.s.env(x) === null) && (this.s.setenv(x, "")); } else { ensure(!(i < 1), () => bad("EINVAL", `export: ${x}`)); this.s.setenv(x.slice(0, i), x.slice(i + 1)); } }
        return 0;
      case "unset": for (const x of a) this.s.unset(x); return 0;
      case "set": for (const [k, v] of [...(this.s.env(null) as Map<string, string>)].sort()) await this.s.out(`${k}=${this.quote(v)}\n`); return 0;
      case "alias":
        if (!a.length) for (const [k, v] of this.aliases) await this.s.out(`alias ${k}=${this.quote(v)}\n`);
        // Command, job and here-document state remain scoped to their current execution phase.
        //@cg-expect-warning
        for (const x of a) { const i = x.indexOf("="); if (i < 1) { const v = (this.aliases.get(x) ?? null); if (v) await this.s.out(`alias ${x}=${this.quote(v)}\n`); else return 1; } else this.aliases.set(x.slice(0, i), x.slice(i + 1)); }
        return 0;
      case "unalias": for (const x of a) this.aliases.delete(x); return 0;
      case "history": {
        if ((a[0] ?? null) === "-c") { this.clearHistory(); return 0; }
        if ((a[0] ?? null) === "-w") { this.saveHistory(); return 0; }
        if ((a[0] ?? null) === "-d") { const n=Number.parseInt(a[1]??"",10); ensure(!(!Number.isSafeInteger(n)||n<1||n>this.hist.length), () => bad("EINVAL","history index")); this.hist.splice(n-1,1); this.saveHistory(); return 0; }
        const count=(a[0] ?? null)===null?this.hist.length:Number.parseInt((requireValue(a[0] ?? null, "src/sh/shell.ts:637") ?? null),10); if(!Number.isSafeInteger(count)||count<0) bad("EINVAL","history count");
        const start=Math.max(0,this.hist.length-count); for(let i=start;i<this.hist.length;i++) await this.s.out(`${String(i+1).padStart(5)}  ${requireValue(this.hist[i] ?? null, "src/sh/shell.ts:625").replace(/\n/g,"\\n")}\n`); return 0;
      }
      case "prefs": {
        if (!a.length) { await this.s.out(prefsText(this.prefs)); return 0; }
        if ((a[0] ?? null) === "reload") { const warnings=this.reloadPreferences(); for(const w of warnings) await this.s.err(`prefs: ${w}\n`); return warnings.length?1:0; }
        if ((a[0] ?? null) === "get") { const key=(a[1] ?? null) as keyof ShellPrefs|null; ensure(!(!key||!PREF_KEYS.includes(key)), () => bad("EINVAL","prefs key")); const value=this.prefs[requireValue(key ?? null, "src/sh/shell.ts:630")]; await this.s.out(`${requireValue(key ?? null, "src/sh/shell.ts:630")}=${Array.isArray(value)?JSON.stringify(value.join(",")):typeof value==="string"?JSON.stringify(value):String(value)}\n`); return 0; }
        if ((a[0] ?? null) === "set") { ensure(!(this.s.uid!==0), () => bad("EPERM","prefs set")); const key=(a[1] ?? null) as keyof ShellPrefs|null,value=a.slice(2).join(" "); ensure(!(!key||!PREF_KEYS.includes(key)||!value), () => bad("EINVAL","usage: prefs set key value")); const current=this.maybeRead("/opt/prefs")??""; this.s.write("/opt/prefs",updatePrefsText(current,requireValue(key ?? null, "src/sh/shell.ts:631"),value),false,0o644);this.s.chmod("/opt/prefs",0o644);const warnings=this.reloadPreferences();for(const w of warnings)await this.s.err(`prefs: ${w}\n`);return warnings.length?1:0; }
        bad("EINVAL","usage: prefs [get key|set key value|reload]");
      }
      case "jobs": return this.showJobs();
      case "fg": return this.foreground(a[0] ?? `%${[...this.jobs.keys()].at(-1) ?? 0}`);
      case "wait": return this.waitJob((a[0] ?? null));
      case "umask":
        if (!a.length) await this.s.out(this.s.umask.toString(8).padStart(4, "0") + "\n");
        else { const n = Number.parseInt(requireValue(a[0] ?? null, "src/sh/shell.ts:639"), 8); ensure(Number.isFinite(n), () => bad("EINVAL", (requireValue(a[0] ?? null, "src/sh/shell.ts:652") ?? null))); this.s.umask = n & 0o777; }
        return 0;
      case "reboot": this.s.reboot(); return 0;
      case "exit": case "logout": throw new ShExit(Number(a[0] ?? this.last) || 0);
      default: return 127;
    }
  }

  private async showJobs(): Promise<number> {
    for (const j of this.jobs.values()) await this.s.out(`[${j.id}] ${j.code === null ? "Running" : `Done(${j.code})`}\t${j.src}\n`);
    return 0;
  }

  private job(s: string): Job {
    const id = Number(s.replace(/^%/, ""));
    return this.jobs.get(id) ?? bad("ESRCH", `job ${s}`);
  }

  private async foreground(x: string): Promise<number> {
    const j = this.job(x);
    this.fg = j.pgid;
    try {
      const n = await j.done;
      for (const p of j.ps) this.s.reap(p.pid);
      this.jobs.delete(j.id);
      return n;
    } finally { this.fg = 0; }
  }

  private async waitJob(x: string | null = null): Promise<number> {
    if (x) return this.foreground(x.startsWith("%") ? x : `%${x}`);
    let n = 0;
    for (const id of [...this.jobs.keys()]) n = await this.foreground(`%${id}`);
    return n;
  }

  interrupt(): void {
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
    if (this.fg) { try { this.s.kill(-this.fg, 2); } catch { /* it may have won the race */ } }
  }

  private pathCommands(prefix: string): string[] {
    const configured = this.s.env("PATH");
    const directories = (typeof configured === "string" ? configured : "/bin").split(":");
    const names = new Set<string>();

    for (const directory of directories) {
      let entries: ReturnType<Sys["list"]>;
      try { entries = this.s.list(directory || "."); }
      catch { continue; }

      for (const [name, node] of entries) {
        if (!name.startsWith(prefix) || (node.mode & 0o111) === 0) continue;
        try {
          this.s.which(name);
          names.add(name);
        // This documented best-effort fallback intentionally continues after the optional operation fails.
        //@cg-expect-warning
        } catch { /* Only suggest commands executable by this account. */ }
      }
    }
    return [...names];
  }

  complete(src: string): { line: string; list: string[] } {
    const m = /(^|\s)([^\s]*)$/.exec(src);
    if (!m) return { line: src, list: [] };
    const pre = src.slice(0, m.index + requireValue(m[1] ?? null, "src/sh/shell.ts:703").length);
    const x = requireValue(m[2] ?? null, "src/sh/shell.ts:704");
    let list: string[];
    if (x.includes("/")) {
      const i = x.lastIndexOf("/");
      const d = x.slice(0, i) || "/";
      const b = x.slice(i + 1);
      try { list = this.s.list(d).map(([n, v]) => `${x.slice(0, i + 1)}${n}${v.kind === "dir" ? "/" : ""}`).filter(n => n.startsWith(x.slice(0, i + 1) + b)); }
      catch { list = []; }
    } else list = [...new Set([...this.s.apps().map(a => a.name), ...built,
      ...this.aliases.keys(), ...this.pathCommands(x)])].filter(n => n.startsWith(x)).sort();
    if (list.length === 1) return { line: pre + (list[0] ?? null) + (requireValue(list[0] ?? null, "src/sh/shell.ts:714").endsWith("/") ? "" : " "), list };
    if (list.length > 1) {
      let p = requireValue(list[0] ?? null, "src/sh/shell.ts:716");
      while (p && !list.every(z => z.startsWith(p))) p = p.slice(0, -1);
      // Command, job and here-document state remain scoped to their current execution phase.
      //@cg-expect-warning
      if (p.length > x.length) return { line: pre + p, list };
    }
    return { line: src, list };
  }

  private quote(s: string): string { return /^[A-Za-z0-9_./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`; }
}

function continues(line: string): boolean {
    let quote = "", escaped = false, comment = -1;
    for (let i = 0; i < line.length; i++) {
      const character = requireValue(line[i] ?? null, "src/sh/shell.ts:191");
      if (escaped) { escaped = false; continue; }
      if (character === "\\" && quote !== "'") { escaped = true; continue; }
      if (quote) { (character === quote) && (quote = ""); continue; }
      if (character === "'" || character === "\"") { quote = character; continue; }
      if (character === "#" && (i === 0 || /\s/.test(requireValue(line[i - 1] ?? null, "src/sh/shell.ts:196")))) { comment = i; break; }
    }
    if (quote === "'") return false;
    const visible = (comment >= 0 ? line.slice(0, comment) : line).trimEnd();
    let slashes = 0;
    for (let i = visible.length - 1; i >= 0 && (visible[i] ?? null) === "\\"; i--) slashes++;
    return slashes % 2 === 1;
  }
