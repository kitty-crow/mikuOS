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
  for (let i = source.length - 1; i >= 0 && source[i] === "\\"; i--) count++;
  return count % 2 === 1;
};

export class LineEditor {
  private line = "";
  private cursor = 0;
  private historyIndex = 0;
  private historyDraft = "";
  private prefixHistory: PrefixHistoryState | undefined;
  private suggestionIndex = 0;
  private suggestionSuppressed = false;
  private completionCandidates: string[] = [];
  private completionIndex = -1;
  private reverse: ReverseState | undefined;
  private heredoc: HereState | undefined;
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
    this.prefixHistory = undefined;
    this.suggestionIndex = 0;
    this.suggestionSuppressed = false;
    this.reverse = undefined;
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

  private suggestion(): string | undefined {
    const matches = this.matches();
    if (!matches.length) {
      this.suggestionIndex = 0;
      return undefined;
    }
    this.suggestionIndex = ((this.suggestionIndex % matches.length) + matches.length) % matches.length;
    return matches[this.suggestionIndex];
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
      const entry = entries[index]!;
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
      if (!this.line || this.cursor !== this.line.length) return false;

      const matches = this.prefixMatches(this.line);

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
    this.line = state.matches[state.index]!;
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
      this.line = state.matches[state.index]!;
    } else {
      this.line = state.prefix;
      this.prefixHistory = undefined;
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
      const entry = entries[index]!;
      const candidate = caseSensitive ? entry : entry.toLocaleLowerCase();
      if (candidate.includes(needle)) output.push(entry);
    }

    return output;
  }

  render(): void {
    if (this.host.busy()) return;

    if (this.reverse) {
      this.reverse.matches = this.reverseMatches(this.reverse.query);
      if (this.reverse.index >= this.reverse.matches.length) {
        this.reverse.index = Math.max(0, this.reverse.matches.length - 1);
      }

      const hit = this.reverse.matches[this.reverse.index];
      const failed = !hit;
      const colour = failed && this.host.shell.prefs.colour ? "\x1b[31m" : "";
      const reset = colour ? "\x1b[0m" : "";
      const label = failed ? "(failed reverse-i-search)" : "(reverse-i-search)";
      this.host.write(`\r\x1b[2K${colour}${label}\`${this.reverse.query}': ${hit ?? ""}${reset}`);
      return;
    }

    const suggestion = this.suggestion();
    const suffix = suggestion?.startsWith(this.line) ? suggestion.slice(this.line.length) : "";
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

    const prefix = source.slice(0, match.index + match[1]!.length);
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
      this.line = this.completionCandidates[this.completionIndex]!;
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
      this.line = this.completionCandidates[this.completionIndex]!;
      this.cursor = this.line.length;
      this.render();
      return;
    }

    if (result.list.length > 1 && result.line === original) {
      const visible = result.list.slice(0, this.host.shell.prefs.completionListLimit);
      this.host.write(`\r\n${visible.join("  ")}\r\n`);
      if (result.list.length > visible.length) {
        this.host.write(`... ${result.list.length - visible.length} more\r\n`);
      }
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
      while (end < suggestion.length && /\s/.test(suggestion[end]!)) end++;
      while (end < suggestion.length && !/\s/.test(suggestion[end]!)) end++;
      this.line = suggestion.slice(0, end);
      this.cursor = this.line.length;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (this.cursor < this.line.length) {
      let end = this.cursor;
      while (end < this.line.length && /\s/.test(this.line[end]!)) end++;
      while (end < this.line.length && !/\s/.test(this.line[end]!)) end++;
      this.cursor = end;
      this.render();
      return;
    }

    this.bell();
  }

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
    this.reverse = undefined;
    this.resetCompletion();

    if (this.heredoc) {
      const source = current;
      const request = this.heredoc.requests[this.heredoc.index]!;
      const body = request.stripTabs ? source.replace(/^\t+/, "") : source;

      if (body === request.delimiter) {
        this.heredoc.bodies.push(this.heredoc.lines.join(""));
        this.heredoc.lines = [];
        this.heredoc.index++;

        if (this.heredoc.index >= this.heredoc.requests.length) {
          const command = this.heredoc.src;
          const bodies = this.heredoc.bodies;
          this.heredoc = undefined;
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

  key(raw: string): void {
    if (this.host.busy()) {
      this.host.passthrough(raw);
      return;
    }

    const prefs = this.host.shell.prefs;
    const input = raw.replaceAll("\x1b[200~", "").replaceAll("\x1b[201~", "");
    if (!input) return;

    if (input.includes("\n") || input.includes("\r")) {
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

    const historyPreviousKey = keyMatches(
      input,
      prefs.keyHistoryPrevious,
    );

    const historyNextKey = keyMatches(
      input,
      prefs.keyHistoryNext,
    );

    if (!historyPreviousKey && !historyNextKey) {
      this.prefixHistory = undefined;
    }

    const completionKey =
      keyMatches(input, prefs.keyCompleteNext) ||
      keyMatches(input, prefs.keyCompletePrevious);

    if (!completionKey) this.resetCompletion();

    if (this.reverse) {
      if (input === "\x03") {
        this.line = "";
        this.cursor = 0;
        this.reverse = undefined;
        this.host.write("^C\r\n");
        this.render();
        return;
      }

      if (input === "\x07" || keyMatches(input, prefs.keySuggestionSuppress)) {
        this.line = this.reverse.originalLine;
        this.cursor = this.reverse.originalCursor;
        this.reverse = undefined;
        this.render();
        return;
      }

      const reverseNext = keyMatches(input, prefs.keyHistorySearchReverse);
      const reversePrevious = prefs.ctrlSForwardSearch && keyMatches(input, prefs.keyHistorySearchForward);
      if (reverseNext || reversePrevious) {
        this.reverse.matches = this.reverseMatches(this.reverse.query);
        if (this.reverse.matches.length) {
          const delta = reverseNext ? 1 : -1;
          this.reverse.index = (this.reverse.index + delta + this.reverse.matches.length) % this.reverse.matches.length;
        } else {
          this.bell();
        }
        this.render();
        return;
      }

      if (input === "\r" || input === "\n" || input === "\x1b[D" || input === "\x1b[C") {
        const hit = this.reverse.matches[this.reverse.index];
        if (hit) {
          this.line = hit;
          this.cursor = hit.length;
        }
        this.reverse = undefined;
        this.render();
        return;
      }

      if (input === "\x7f" || input === "\b") {
        if (this.reverse.query) this.reverse.query = this.reverse.query.slice(0, -1);
        else this.bell();
        this.reverse.index = 0;
        this.render();
        return;
      }

      if ([...input].every(character => character >= " " && character !== "\x7f")) {
        this.reverse.query += input;
        this.reverse.index = 0;
        this.render();
      }
      return;
    }

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

    if (keyMatches(input, prefs.keySuggestionOlder)) {
      const matches = this.matches();
      if (!matches.length) {
        this.bell();
        return;
      }
      this.suggestionIndex = (this.suggestionIndex + 1) % matches.length;
      this.render();
      return;
    }

    if (keyMatches(input, prefs.keySuggestionNewer)) {
      const matches = this.matches();
      if (!matches.length) {
        this.bell();
        return;
      }
      this.suggestionIndex = (this.suggestionIndex - 1 + matches.length) % matches.length;
      this.render();
      return;
    }

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
      this.heredoc = undefined;
      this.continuation = "";
      this.reverse = undefined;
      this.historyDraft = "";
      this.suggestionIndex = 0;
      this.suggestionSuppressed = false;
      this.host.write("^C\r\n");
      this.render();
      return;
    }

    if (input === "\x04" && !this.line) {
      if (this.continuation) this.submit(true);
      else this.host.halt();
      return;
    }

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

    if (input === "\x1b[D" || input === "\x02") {
      if (this.cursor > 0) this.cursor--;
      else this.bell();
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (input === "\x1b[C" || input === "\x06") {
      if (this.cursor < this.line.length) this.cursor++;
      else this.bell();
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (input === "\x7f" || input === "\b") {
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

    if (input === "\x1b[3~") {
      if (this.cursor < this.line.length) {
        this.line = this.line.slice(0, this.cursor) + this.line.slice(this.cursor + 1);
        this.suggestionIndex = 0;
      } else {
        this.bell();
      }
      this.render();
      return;
    }

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
      while (at > 0 && /\s/.test(this.line[at - 1]!)) at--;
      while (at > 0 && !/\s/.test(this.line[at - 1]!)) at--;
      this.line = this.line.slice(0, at) + this.line.slice(this.cursor);
      this.cursor = at;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (historyPreviousKey) {
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
        this.line = entries[this.historyIndex]!;
        this.cursor = this.line.length;
      } else {
        this.bell();
      }
      this.suggestionIndex = 0;
      this.render();
      return;
    }

    if (historyNextKey) {
      if (this.prefixHistoryNext()) return;

      const entries = this.entries();
      if (this.historyIndex < entries.length - 1) {
        this.historyIndex++;
        this.line = entries[this.historyIndex]!;
      } else if (this.historyIndex === entries.length - 1) {
        this.historyIndex = entries.length;
        this.line = this.historyDraft;
      } else {
        this.bell();
      }
      this.cursor = this.line.length;
      this.suggestionIndex = 0;
      this.render();
      return;
    }

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
