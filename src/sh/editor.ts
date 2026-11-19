import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import type { Shell } from "./shell.js";
import { keyMatches } from "./keys.js";

export interface EditorHost {
  shell: Shell;
  prompt(): string;
  busy(): boolean;
  write(text: string): void;
  execute(source: string, bodies: readonly string[]): void;
  passthrough(data: string): void;
  halt(): void;
  complete(line: string): { line: string; list: string[] };
}

interface ReverseState {
  query: string;
  originalLine: string;
  originalCursor: number;
  matches: string[];
  index: number;
}

interface HereState {
  src: string;
  requests: ReturnType<Shell["heredocs"]>;
  bodies: string[];
  lines: string[];
  index: number;
}

interface PrefixHistoryState {
  prefix: string;
  matches: string[];
  index: number;
}

const trailingContinuation = (source: string): boolean => {
  let count = 0;
  for (let i = source.length - 1; i >= 0 && (source[i] ?? null) === "\\"; i--) count++;
  return count % 2 === 1;
};

export class LineEditor {
  private line = "";
  private cursor = 0;
  private historyIndex = 0;
  private historyDraft = "";
  private prefixHistory: PrefixHistoryState | null = null;
  private suggestionIndex = 0;
  private suggestionSuppressed = false;
  private completionCandidates: string[] = [];
  private completionIndex = -1;
  private reverse: ReverseState | null = null;
  private heredoc: HereState | null = null;
  private continuation = "";

  constructor(private readonly host: EditorHost) {
    this.afterCommand(false);
  }

  private entries(): string[] {
    return this.host.shell.hist.filter(entry => !entry.includes("\n"));
  }

  afterCommand(render = true): void {
    this.historyIndex = this.entries().length;
    this.historyDraft = "";
    this.prefixHistory = null;
    this.suggestionIndex = 0;
    this.suggestionSuppressed = false;
    this.reverse = null;
    this.resetCompletion();
    if (render) this.render();
  }

  private prompt(): string {
    if (this.heredoc) return this.host.shell.prefs.heredocSilent ? "" : this.host.shell.prefs.heredocPrompt;
    if (this.continuation) return "> ";
    return this.host.prompt();
  }

  private matches(): string[] {
    if (
      this.heredoc ||
      this.reverse ||
      this.suggestionSuppressed ||
      !this.host.shell.prefs.autocomplete ||
      this.cursor !== this.line.length
    ) {
      return [];
    }
    return this.host.shell.historyMatches(this.line);
  }

  private suggestion(): string | null {
    const matches = this.matches();
    if (!matches.length) {
      this.suggestionIndex = 0;
      return null;
    }
    this.suggestionIndex = ((this.suggestionIndex % matches.length) + matches.length) % matches.length;
    return (matches[this.suggestionIndex] ?? null);
  }

  private prefixMatches(prefix: string): string[] {
    const caseSensitive = this.host.shell.prefs.autocompleteCaseSensitive;
    const needle = caseSensitive
      ? prefix
      : prefix.toLocaleLowerCase();

    const output: string[] = [];
    const seen = new Set<string>();
    const entries = this.entries();

    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = requireValue(entries[index] ?? null, "src/sh/editor.ts:116");
      const candidate = caseSensitive
        ? entry
        : entry.toLocaleLowerCase();

      if (!candidate.startsWith(needle) || seen.has(entry)) continue;

      seen.add(entry);
      output.push(entry);
    }

    return output;
  }

  private prefixHistoryPrevious(): boolean {
    const prefs = this.host.shell.prefs;

    if (!prefs.historyPrefixSearch) return false;

    if (!this.prefixHistory) {
      // Editor transitions commit the active input or history mode before redrawing the prompt.
      //@cg-expect-warning
      if (!this.line || this.cursor !== this.line.length) return false;

      const matches = this.prefixMatches(this.line);

      // Editor transitions commit the active input or history mode before redrawing the prompt.
      //@cg-expect-warning
      if (!matches.length) {
        this.bell();
        return true;
      }

      this.prefixHistory = {
        prefix: this.line,
        matches,
        index: -1,
      };
    }

    const state = this.prefixHistory;

    if (state.index >= state.matches.length - 1) {
      this.bell();
      return true;
    }

    state.index++;
    this.line = requireValue(state.matches[state.index] ?? null, "src/sh/editor.ts:160");
    this.cursor = this.line.length;
    this.suggestionIndex = 0;
    this.render();
    return true;
  }

  private prefixHistoryNext(): boolean {
    const state = this.prefixHistory;

    if (!state) return false;

    if (state.index > 0) {
      state.index--;
      this.line = requireValue(state.matches[state.index] ?? null, "src/sh/editor.ts:174");
    } else {
      this.line = state.prefix;
      this.prefixHistory = null;
    }

    this.cursor = this.line.length;
    this.suggestionIndex = 0;
    this.render();
    return true;
  }

  private reverseMatches(query: string): string[] {
    const caseSensitive = this.host.shell.prefs.autocompleteCaseSensitive;
    const needle = caseSensitive ? query : query.toLocaleLowerCase();
    const output: string[] = [];
    const entries = this.entries();

    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = requireValue(entries[index] ?? null, "src/sh/editor.ts:193");
      const candidate = caseSensitive ? entry : entry.toLocaleLowerCase();
      if (candidate.includes(needle)) output.push(entry);
    }

    return output;
  }

  render(): void {
    if (this.host.busy()) return;

    if (this.reverse) {
      this.reverse.matches = this.reverseMatches(this.reverse.query);
      (this.reverse.index >= this.reverse.matches.length) && (this.reverse.index = Math.max(0, this.reverse.matches.length - 1));

      const hit = (this.reverse.matches[this.reverse.index] ?? null);
      const failed = !hit;
      const colour = failed && this.host.shell.prefs.colour ? "\x1b[31m" : "";
      const reset = colour ? "\x1b[0m" : "";
      const label = failed ? "(failed reverse-i-search)" : "(reverse-i-search)";
      this.host.write(`\r\x1b[2K${colour}${label}\`${this.reverse.query}': ${hit ?? ""}${reset}`);
      return;
    }

    const suggestion = this.suggestion();
    const suffix = (withValue(suggestion ?? null, value => value.startsWith(this.line)) ?? null) ? requireValue(suggestion ?? null, "src/sh/editor.ts:222").slice(this.line.length) : "";
    const colour = suffix && this.host.shell.prefs.colour
      ? this.host.shell.prefs.autocompleteColour === "faint" ? "\x1b[2m" : "\x1b[90m"
      : "";
    const reset = colour ? "\x1b[0m" : "";

    this.host.write(`\r\x1b[2K${this.prompt()}${this.line}${colour}${suffix}${reset}`);

    const back = [...suffix].length + [...this.line.slice(this.cursor)].length;
    if (back) this.host.write(`\x1b[${back}D`);
  }

  private bell(): void {
    if (this.host.shell.prefs.bell) this.host.write("\x07");
  }

  private resetCompletion(): void {
    this.completionCandidates = [];
    this.completionIndex = -1;
  }

  private completionLines(source: string, candidates: readonly string[]): string[] {
    const match = /(^|\s)([^\s]*)$/.exec(source);
    if (!match) return [];

    const prefix = source.slice(0, match.index + requireValue(match[1] ?? null, "src/sh/editor.ts:245").length);
    return candidates.map(candidate => prefix + candidate + (candidate.endsWith("/") ? "" : " "));
  }

  private complete(backwards: boolean): void {
    if (this.heredoc) {
      this.insert("\t");
      return;
    }

    if (this.completionCandidates.length) {
      const count = this.completionCandidates.length;
      this.completionIndex = backwards
        ? this.completionIndex < 0
          ? count - 1
          : (this.completionIndex - 1 + count) % count
        : (this.completionIndex + 1) % count;
      this.line = requireValue(this.completionCandidates[this.completionIndex] ?? null, "src/sh/editor.ts:262");
      this.cursor = this.line.length;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    const original = this.line;
    const result = this.host.complete(original);
    this.completionCandidates = this.completionLines(original, result.list);
    this.completionIndex = -1;
    this.line = result.line;
    this.cursor = this.line.length;
    this.suggestionIndex = 0;

    if (backwards && this.completionCandidates.length) {
      this.completionIndex = this.completionCandidates.length - 1;
      this.line = requireValue(this.completionCandidates[this.completionIndex] ?? null, "src/sh/editor.ts:279");
      this.cursor = this.line.length;
      this.render();
      return;
    }

    if (result.list.length > 1 && result.line === original) {
      const visible = result.list.slice(0, this.host.shell.prefs.completionListLimit);
      this.host.write(`\r\n${visible.join("  ")}\r\n`);
      (result.list.length > visible.length) && (this.host.write(`... ${result.list.length - visible.length} more\r\n`));
    }

    if (!result.list.length) this.bell();
    this.render();
  }

  private insert(value: string): void {
    this.line = this.line.slice(0, this.cursor) + value + this.line.slice(this.cursor);
    this.cursor += value.length;
    this.suggestionIndex = 0;
    this.resetCompletion();
    this.render();
  }

  private acceptSuggestion(): void {
    const suggestion = this.suggestion();
    if (suggestion) {
      this.line = suggestion;
      this.cursor = suggestion.length;
    } else {
      this.cursor = this.line.length;
    }
    this.suggestionIndex = 0;
    this.render();
  }

  private acceptSuggestionWord(): void {
    const suggestion = this.suggestion();

    if (suggestion) {
      let end = this.line.length;
      while (end < suggestion.length && /\s/.test(requireValue(suggestion[end] ?? null, "src/sh/editor.ts:322"))) end++;
      while (end < suggestion.length && !/\s/.test(requireValue(suggestion[end] ?? null, "src/sh/editor.ts:323"))) end++;
      this.line = suggestion.slice(0, end);
      this.cursor = this.line.length;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (this.cursor < this.line.length) {
      let end = this.cursor;
      while (end < this.line.length && /\s/.test(requireValue(this.line[end] ?? null, "src/sh/editor.ts:333"))) end++;
      while (end < this.line.length && !/\s/.test(requireValue(this.line[end] ?? null, "src/sh/editor.ts:334"))) end++;
      this.cursor = end;
      this.render();
      return;
    }

    this.bell();
  }

  // Editor transitions commit the active input or history mode before redrawing the prompt.
  //@cg-expect-warning
  private submit(force = false): void {
    const current = this.line;
    // The rendered line may contain a grey history suggestion after the real
    // input. Erase it and commit only the command the user actually typed.
    this.host.write(`\r\x1b[2K${this.prompt()}${current}\r\n`);
    this.line = "";
    this.cursor = 0;
    this.historyDraft = "";
    this.suggestionIndex = 0;
    this.suggestionSuppressed = false;
    this.reverse = null;
    this.resetCompletion();

    if (this.heredoc) {
      const source = current;
      const request = requireValue(this.heredoc.requests[this.heredoc.index] ?? null, "src/sh/editor.ts:358");
      const body = request.stripTabs ? source.replace(/^\t+/, "") : source;

      // Editor transitions commit the active input or history mode before redrawing the prompt.
      //@cg-expect-warning
      if (body === request.delimiter) {
        this.heredoc.bodies.push(this.heredoc.lines.join(""));
        this.heredoc.lines = [];
        this.heredoc.index++;

        // Editor transitions commit the active input or history mode before redrawing the prompt.
        //@cg-expect-warning
        if (this.heredoc.index >= this.heredoc.requests.length) {
          const command = this.heredoc.src;
          const bodies = this.heredoc.bodies;
          this.heredoc = null;
          this.host.execute(command, bodies);
        } else {
          this.render();
        }
        return;
      }

      this.heredoc.lines.push(`${body}\n`);
      this.render();
      return;
    }

    if (!force && trailingContinuation(current)) {
      this.continuation += `${current}\n`;
      this.render();
      return;
    }

    const source = force && !current && this.continuation.endsWith("\n")
      ? this.continuation.slice(0, -1)
      : this.continuation + current;
    this.continuation = "";

    let requests: ReturnType<Shell["heredocs"]>;
    try {
      requests = this.host.shell.heredocs(source);
    } catch {
      this.host.execute(source, []);
      return;
    }

    if (requests.length) {
      this.heredoc = { src: source, requests, bodies: [], lines: [], index: 0 };
      this.render();
      return;
    }

    this.host.execute(source, []);
  }


  private paste(input: string): void {

      const pasted = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      for (const character of pasted) {
        if (character === "\n") {
          this.render();
          this.submit();
        } else {
          this.key(character);
        }
      }
      return;

  }

  private reverseKey(input: string): void {
const prefs = this.host.shell.prefs;
const state = requireValue(this.reverse, "reverse search state");

      if (input === "\x03") {
        this.line = "";
        this.cursor = 0;
        this.reverse = null;
        this.host.write("^C\r\n");
        this.render();
        return;
      }

      if (input === "\x07" || keyMatches(input, prefs.keySuggestionSuppress)) {
        this.line = state.originalLine;
        this.cursor = state.originalCursor;
        this.reverse = null;
        this.render();
        return;
      }

      const reverseNext = keyMatches(input, prefs.keyHistorySearchReverse);
      const reversePrevious = prefs.ctrlSForwardSearch && keyMatches(input, prefs.keyHistorySearchForward);
      if (reverseNext || reversePrevious) {
        state.matches = this.reverseMatches(state.query);
        // Editor transitions commit the active input or history mode before redrawing the prompt.
        //@cg-expect-warning
        if (state.matches.length) {
          const delta = reverseNext ? 1 : -1;
          state.index = (state.index + delta + state.matches.length) % state.matches.length;
        } else {
          this.bell();
        }
        this.render();
        return;
      }

      if (input === "\r" || input === "\n" || input === "\x1b[D" || input === "\x1b[C") {
        const hit = (state.matches[state.index] ?? null);
        // Editor transitions commit the active input or history mode before redrawing the prompt.
        //@cg-expect-warning
        if (hit) {
          this.line = hit;
          this.cursor = hit.length;
        }
        this.reverse = null;
        this.render();
        return;
      }

      if (input === "\x7f" || input === "\b") {
        // Editor transitions commit the active input or history mode before redrawing the prompt.
        //@cg-expect-warning
        if (state.query) state.query = state.query.slice(0, -1);
        else this.bell();
        state.index = 0;
        this.render();
        return;
      }

      if ([...input].every(character => character >= " " && character !== "\x7f")) {
        state.query += input;
        state.index = 0;
        this.render();
      }
      return;

  }

  private olderSuggestion(): void {

      const matches = this.matches();
      if (!matches.length) {
        this.bell();
        return;
      }
      this.suggestionIndex = (this.suggestionIndex + 1) % matches.length;
      this.render();
      return;

  }

  private newerSuggestion(): void {

      const matches = this.matches();
      if (!matches.length) {
        this.bell();
        return;
      }
      this.suggestionIndex = (this.suggestionIndex - 1 + matches.length) % matches.length;
      this.render();
      return;

  }

  private endInput(): void {

      if (this.continuation) this.submit(true);
      else this.host.halt();
      return;

  }

  private moveLeft(): void {

      if (this.cursor > 0) this.cursor--;
      else this.bell();
      this.suggestionIndex = 0;
      this.render();
      return;

  }

  private moveRight(): void {

      if (this.cursor < this.line.length) this.cursor++;
      else this.bell();
      this.suggestionIndex = 0;
      this.render();
      return;

  }

  private backspace(): void {

      if (this.cursor > 0) {
        this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor);
        this.cursor--;
        this.suggestionIndex = 0;
      } else {
        this.bell();
      }
      this.render();
      return;

  }

  private deleteForward(): void {

      if (this.cursor < this.line.length) {
        this.line = this.line.slice(0, this.cursor) + this.line.slice(this.cursor + 1);
        this.suggestionIndex = 0;
      } else {
        this.bell();
      }
      this.render();
      return;

  }

  private previousHistory(): void {

      if (this.prefixHistoryPrevious()) return;

      const entries = this.entries();
      if (!entries.length) {
        this.bell();
        return;
      }
      if (this.historyIndex >= entries.length) {
        this.historyDraft = this.line;
        this.historyIndex = entries.length;
      }
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.line = requireValue(entries[this.historyIndex] ?? null, "src/sh/editor.ts:689");
        this.cursor = this.line.length;
      } else {
        this.bell();
      }
      this.suggestionIndex = 0;
      this.render();
      return;

  }

  private nextHistory(): void {

      if (this.prefixHistoryNext()) return;

      const entries = this.entries();
      switch (true) {
case !!(this.historyIndex < entries.length - 1): {
        this.historyIndex++;
        this.line = requireValue(entries[this.historyIndex] ?? null, "src/sh/editor.ts:705");

break; }
case !!(this.historyIndex === entries.length - 1): {
        this.historyIndex = entries.length;
        this.line = this.historyDraft;

break; }
default: {
        this.bell();
       }
}
      this.cursor = this.line.length;
      this.suggestionIndex = 0;
      this.render();
      return;

  }
key(raw: string): void {
    if (this.host.busy()) {
      this.host.passthrough(raw);
      return;
    }

    const prefs = this.host.shell.prefs;
    const input = raw.replaceAll("\x1b[200~", "").replaceAll("\x1b[201~", "");
    if (!input) return;

    if (input.includes("\n") || input.includes("\r")) { this.paste(input); return; }

    const historyPreviousKey = keyMatches(
      input,
      prefs.keyHistoryPrevious,
    );

    const historyNextKey = keyMatches(
      input,
      prefs.keyHistoryNext,
    );

    if (!historyPreviousKey && !historyNextKey) {
      this.prefixHistory = null;
    }

    const completionKey =
      keyMatches(input, prefs.keyCompleteNext) ||
      keyMatches(input, prefs.keyCompletePrevious);

    if (!completionKey) this.resetCompletion();

    if (this.reverse) { this.reverseKey(input); return; }

    if (prefs.reverseSearch && keyMatches(input, prefs.keyHistorySearchReverse)) {
      this.reverse = {
        query: "",
        originalLine: this.line,
        originalCursor: this.cursor,
        matches: this.reverseMatches(""),
        index: 0,
      };
      this.render();
      return;
    }

    if (keyMatches(input, prefs.keySuggestionOlder)) { this.olderSuggestion(); return; }

    if (keyMatches(input, prefs.keySuggestionNewer)) { this.newerSuggestion(); return; }

    if (keyMatches(input, prefs.keySuggestionAccept)) {
      this.acceptSuggestion();
      return;
    }

    if (keyMatches(input, prefs.keySuggestionAcceptWord)) {
      this.acceptSuggestionWord();
      return;
    }

    if (keyMatches(input, prefs.keySuggestionSuppress)) {
      this.suggestionSuppressed = true;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (input === "\x03") {
      this.line = "";
      this.cursor = 0;
      this.heredoc = null;
      this.continuation = "";
      this.reverse = null;
      this.historyDraft = "";
      this.suggestionIndex = 0;
      this.suggestionSuppressed = false;
      this.host.write("^C\r\n");
      this.render();
      return;
    }

    if (input === "\x04" && !this.line) { this.endInput(); return; }

    if (input === "\r" || input === "\n") {
      this.submit();
      return;
    }

    if (input === "\x0c") {
      this.host.write(prefs.clearScrollback ? "\x1b[3J\x1b[2J\x1b[H" : "\x1b[2J\x1b[H");
      this.render();
      return;
    }

    if (input === "\x01" || input === "\x1b[H" || input === "\x1b[1~") {
      this.cursor = 0;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    // End remains ordinary cursor movement when it is remapped away from
    // keySuggestionAccept. Ctrl+E is always the conventional cursor-end key.
    if (input === "\x05" || input === "\x1b[F" || input === "\x1b[4~") {
      this.cursor = this.line.length;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (input === "\x1b[D" || input === "\x02") { this.moveLeft(); return; }

    if (input === "\x1b[C" || input === "\x06") { this.moveRight(); return; }

    if (input === "\x7f" || input === "\b") { this.backspace(); return; }

    if (input === "\x1b[3~") { this.deleteForward(); return; }

    if (input === "\x15") {
      this.line = this.line.slice(this.cursor);
      this.cursor = 0;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (input === "\x0b") {
      this.line = this.line.slice(0, this.cursor);
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (input === "\x17") {
      let at = this.cursor;
      while (at > 0 && /\s/.test(requireValue(this.line[at - 1] ?? null, "src/sh/editor.ts:666"))) at--;
      while (at > 0 && !/\s/.test(requireValue(this.line[at - 1] ?? null, "src/sh/editor.ts:667"))) at--;
      this.line = this.line.slice(0, at) + this.line.slice(this.cursor);
      this.cursor = at;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (historyPreviousKey) { this.previousHistory(); return; }

    if (historyNextKey) { this.nextHistory(); return; }

    if (keyMatches(input, prefs.keyCompleteNext)) {
      this.complete(false);
      return;
    }

    if (keyMatches(input, prefs.keyCompletePrevious)) {
      this.complete(true);
      return;
    }

    if ([...input].every(character => character >= " " && character !== "\x7f")) {
      this.insert(input);
    }
  }
}
