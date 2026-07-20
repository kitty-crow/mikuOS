import { bad } from "../core/err.js";

export interface Word { v: string; q: boolean; }
export interface Tok extends Word { op: boolean; }
export type Gate = ";" | "&&" | "||";
export type RMode = "r" | "w" | "a" | "here";

export interface Redir {
  fd: 0 | 1 | 2;
  mode: RMode;
  path: Word;
  body?: string;
  stripTabs?: boolean;
  expand?: boolean;
}
export interface Cmd { words: Word[]; redir: Redir[]; }
export interface Unit { pipe: Cmd[]; gate: Gate; bg: boolean; src: string; }
export interface Raw { src: string; gate: Gate; bg: boolean; }

const ops = ["2>>", "2>", "&&", "||", "<<-", "<<", ">>", "|", ";", "&", "<", ">"];

const sub = (s: string, at: number, env: Map<string, string>, pid: number, last: number, bg: number): [string, number] => {
  const c = s[at + 1];
  if (c === "?") return [String(last), at + 2];
  if (c === "$") return [String(pid), at + 2];
  if (c === "!") return [bg ? String(bg) : "", at + 2];
  if (c === "#") return [env.get("#") ?? "0", at + 2];
  if (c === "*" || c === "@") return [env.get("*") ?? "", at + 2];
  if (c && /[0-9]/.test(c)) return [env.get(c) ?? "", at + 2];
  if (c === "{") {
    const z = s.indexOf("}", at + 2);
    if (z < 0) bad("EINVAL", "unclosed variable expansion");
    const k = s.slice(at + 2, z);
    return [env.get(k) ?? "", z + 1];
  }
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(at + 1));
  if (!m) return ["$", at + 1];
  return [env.get(m[0]) ?? "", at + 1 + m[0].length];
};

type ArithmeticToken = {
  kind: "number" | "name" | "operator" | "end";
  value: string;
};

const arithmeticOperators = [
  "||", "&&", "==", "!=", "<=", ">=", "<<", ">>",
  "+", "-", "*", "/", "%", "<", ">", "&", "^", "|",
  "!", "~", "(", ")",
];

const arithmeticPrecedence: Readonly<Record<string, number>> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "<": 7,
  "<=": 7,
  ">": 7,
  ">=": 7,
  "<<": 8,
  ">>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
};

const arithmeticNumber = (
  name: string,
  env: Map<string, string>,
): bigint => {
  const raw = env.get(name)?.trim() || "0";

  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
};

const arithmeticTokens = (src: string): ArithmeticToken[] => {
  const tokens: ArithmeticToken[] = [];

  for (let i = 0; i < src.length;) {
    const c = src[i]!;

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(c)) {
      const start = i;

      if (
        c === "0" &&
        (src[i + 1] === "x" || src[i + 1] === "X")
      ) {
        i += 2;

        while (i < src.length && /[0-9a-fA-F]/.test(src[i]!)) {
          i++;
        }
      } else {
        while (i < src.length && /[0-9]/.test(src[i]!)) {
          i++;
        }
      }

      tokens.push({
        kind: "number",
        value: src.slice(start, i),
      });

      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const start = i++;

      while (
        i < src.length &&
        /[A-Za-z0-9_]/.test(src[i]!)
      ) {
        i++;
      }

      tokens.push({
        kind: "name",
        value: src.slice(start, i),
      });

      continue;
    }

    const operator = arithmeticOperators.find(
      value => src.startsWith(value, i),
    );

    if (!operator) {
      throw new Error(
        `invalid arithmetic token near ${JSON.stringify(src.slice(i))}`,
      );
    }

    tokens.push({
      kind: "operator",
      value: operator,
    });

    i += operator.length;
  }

  tokens.push({
    kind: "end",
    value: "",
  });

  return tokens;
};

const evaluateArithmetic = (
  src: string,
  env: Map<string, string>,
): string => {
  const tokens = arithmeticTokens(src);
  let at = 0;

  const current = (): ArithmeticToken => tokens[at]!;

  const take = (): ArithmeticToken => tokens[at++]!;

  const signed = (value: bigint): bigint =>
    BigInt.asIntN(64, value);

  const primary = (): bigint => {
    const token = take();

    if (token.kind === "number") {
      return signed(BigInt(token.value));
    }

    if (token.kind === "name") {
      return signed(arithmeticNumber(token.value, env));
    }

    if (
      token.kind === "operator" &&
      token.value === "("
    ) {
      const value = expression(1);
      const close = take();

      if (
        close.kind !== "operator" ||
        close.value !== ")"
      ) {
        throw new Error("missing ')' in arithmetic expansion");
      }

      return value;
    }

    if (
      token.kind === "operator" &&
      ["+", "-", "!", "~"].includes(token.value)
    ) {
      const value = primary();

      switch (token.value) {
        case "+":
          return value;

        case "-":
          return signed(-value);

        case "!":
          return value === 0n ? 1n : 0n;

        case "~":
          return signed(~value);
      }
    }

    throw new Error("expected arithmetic value");
  };

  const apply = (
    operator: string,
    left: bigint,
    right: bigint,
  ): bigint => {
    switch (operator) {
      case "||":
        return left !== 0n || right !== 0n ? 1n : 0n;

      case "&&":
        return left !== 0n && right !== 0n ? 1n : 0n;

      case "|":
        return signed(left | right);

      case "^":
        return signed(left ^ right);

      case "&":
        return signed(left & right);

      case "==":
        return left === right ? 1n : 0n;

      case "!=":
        return left !== right ? 1n : 0n;

      case "<":
        return left < right ? 1n : 0n;

      case "<=":
        return left <= right ? 1n : 0n;

      case ">":
        return left > right ? 1n : 0n;

      case ">=":
        return left >= right ? 1n : 0n;

      case "<<":
        return signed(left << BigInt.asUintN(6, right));

      case ">>":
        return signed(left >> BigInt.asUintN(6, right));

      case "+":
        return signed(left + right);

      case "-":
        return signed(left - right);

      case "*":
        return signed(left * right);

      case "/":
        if (right === 0n) {
          throw new Error("division by zero");
        }

        return signed(left / right);

      case "%":
        if (right === 0n) {
          throw new Error("division by zero");
        }

        return signed(left % right);
    }

    throw new Error(`unsupported arithmetic operator ${operator}`);
  };

  const expression = (minimum: number): bigint => {
    let left = primary();

    for (;;) {
      const token = current();

      if (token.kind !== "operator") {
        break;
      }

      const precedence = arithmeticPrecedence[token.value];

      if (precedence === undefined || precedence < minimum) {
        break;
      }

      const operator = take().value;
      const right = expression(precedence + 1);

      left = apply(operator, left, right);
    }

    return left;
  };

  const result = expression(1);

  if (current().kind !== "end") {
    throw new Error("unexpected arithmetic input");
  }

  return signed(result).toString();
};

const arithmeticExpansion = (
  src: string,
  start: number,
  env: Map<string, string>,
): [string, number] => {
  let depth = 0;

  for (let i = start + 3; i < src.length; i++) {
    const c = src[i]!;

    if (c === "(") {
      depth++;
      continue;
    }

    if (c !== ")") {
      continue;
    }

    if (depth > 0) {
      depth--;
      continue;
    }

    if (src[i + 1] !== ")") {
      continue;
    }

    const expression = src.slice(start + 3, i);

    return [
      evaluateArithmetic(expression, env),
      i + 2,
    ];
  }

  throw new Error("unterminated arithmetic expansion");
};

const commandExpansion = (
  src: string,
  start: number,
): [string, number] => {
  let depth = 1;
  let quote: "'" | '"' | undefined;
  let quoteDepth = 0;

  for (let i = start + 2; i < src.length; i++) {
    const c = src[i]!;

    if (c === "\\" && quote !== "'") {
      i++;
      continue;
    }

    if (quote === "'") {
      if (c === "'") quote = undefined;
      continue;
    }

    if (quote === '"') {
      if (c === '"') {
        quote = undefined;
        continue;
      }

      if (c === "$" && src[i + 1] === "(") {
        depth++;
        i++;

        if (src[i + 1] === "(") {
          depth++;
          i++;
        }

        continue;
      }

      if (c === ")" && depth > quoteDepth) {
        depth--;
      }

      continue;
    }

    if (c === "'" || c === '"') {
      quote = c;
      quoteDepth = depth;
      continue;
    }

    if (c === "(") {
      depth++;
      continue;
    }

    if (c !== ")") continue;

    depth--;

    if (depth === 0) {
      return [
        src.slice(start + 2, i),
        i + 1,
      ];
    }
  }

  throw new Error("unterminated command substitution");
};

export const expandHereDoc = async (
  src: string,
  env: Map<string, string>,
  pid: number,
  last: number,
  bg: number,
  commandSubstitute: (command: string) => Promise<string>,
): Promise<string> => {
  let out = "";

  for (let i = 0; i < src.length;) {
    const c = src[i]!;

    if (c === "\\") {
      const next = src[i + 1];

      if (next === "\n") {
        i += 2;
        continue;
      }

      if (next === "\\" || next === "$" || next === "`") {
        out += next;
        i += 2;
        continue;
      }

      out += c;
      i++;
      continue;
    }

    if (
      c === "$" &&
      src[i + 1] === "(" &&
      src[i + 2] === "("
    ) {
      const expanded = arithmeticExpansion(src, i, env);
      out += expanded[0];
      i = expanded[1];
      continue;
    }

    if (c === "$" && src[i + 1] === "(") {
      const expanded = commandExpansion(src, i);
      out += await commandSubstitute(expanded[0]);
      i = expanded[1];
      continue;
    }

    if (c === "$") {
      const expanded = sub(src, i, env, pid, last, bg);
      out += expanded[0];
      i = expanded[1];
      continue;
    }

    out += c;
    i++;
  }

  return out;
};

// Split lists before expansion. Otherwise `export X=y; echo $X` would expand
// both commands against yesterday's environment, which is a pretty odd shell.
export const split = (src: string): Raw[] => {
  const out: Raw[] = [];
  let at = 0, gate: Gate = ";", q = "", esc = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (q) { if (c === q) q = ""; continue; }
    if (c === "'" || c === "\"") { q = c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(src[i - 1]!))) {
      const command = src.slice(at, i).trim();
      if (command) out.push({ src: command, gate, bg: false });
      const next = src.indexOf("\n", i);
      if (next < 0) return out;
      gate = ";";
      i = next;
      at = next + 1;
      continue;
    }
    const op = src.startsWith("&&", i) ? "&&" : src.startsWith("||", i) ? "||" : c === ";" || c === "\n" ? ";" : c === "&" ? "&" : "";
    if (!op) continue;
    const command = src.slice(at, i).trim();
    if (command) out.push({ src: command, gate, bg: op === "&" });
    gate = op === "&&" || op === "||" ? op : ";";
    i += op.length - 1;
    at = i + 1;
  }
  if (q) bad("EINVAL", `unclosed ${q === "'" ? "single" : "double"} quote`);
  const command = src.slice(at).trim();
  if (command) out.push({ src: command, gate, bg: false });
  return out;
};

export const lex = (src: string, env: Map<string, string>, pid: number, last: number, bg: number): Tok[] => {
  const out: Tok[] = [];
  let v = "";
  let q = false;
  let hit = false;
  let i = 0;
  const push = (): void => {
    if (!hit) return;
    if (!q && v.startsWith("~") && (v.length === 1 || v[1] === "/")) v = (env.get("HOME") ?? "/") + v.slice(1);
    out.push({ v, q, op: false });
    v = ""; q = false; hit = false;
  };

  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { push(); i++; continue; }
    if (c === "#" && !hit) break;
    const op = ops.find(x => src.startsWith(x, i));
    if (op) { push(); out.push({ v: op, q: false, op: true }); i += op.length; continue; }
    if (c === "\\") {
      if (++i >= src.length) bad("EINVAL", "trailing escape");
      v += src[i++]!; hit = true; q = true; continue;
    }
    if (c === "'") {
      q = true; hit = true; i++;
      const z = src.indexOf("'", i);
      if (z < 0) bad("EINVAL", "unclosed single quote");
      v += src.slice(i, z); i = z + 1; continue;
    }
    if (c === "\"") {
      q = true; hit = true; i++;
      while (i < src.length && src[i] !== "\"") {
        if (src[i] === "\\" && /["\\$]/.test(src[i + 1] ?? "")) { v += src[i + 1]; i += 2; continue; }
        if (src[i] === "$") { const x = sub(src, i, env, pid, last, bg); v += x[0]; i = x[1]; continue; }
        v += src[i++]!;
      }
      if (src[i] !== "\"") bad("EINVAL", "unclosed double quote");
      i++; continue;
    }
    if (c === "$") { const x = sub(src, i, env, pid, last, bg); v += x[0]; i = x[1]; hit = true; continue; }
    v += c; hit = true; i++;
  }
  push();
  return out;
};

export const parse = (t: Tok[]): Unit[] => {
  const out: Unit[] = [];
  let pipe: Cmd[] = [];
  let cmd: Cmd = { words: [], redir: [] };
  let gate: Gate = ";";

  const pcmd = (): void => {
    if (!cmd.words.length) bad("EINVAL", "missing command");
    pipe.push(cmd);
    cmd = { words: [], redir: [] };
  };
  const punit = (bg: boolean): void => {
    pcmd();
    out.push({ pipe, gate, bg, src: pipe.map(x => x.words.map(w => w.v).join(" ")).join(" | ") });
    pipe = [];
  };

  for (let i = 0; i < t.length; i++) {
    const x = t[i]!;
    if (!x.op) { cmd.words.push({ v: x.v, q: x.q }); continue; }
    if (x.v === "<<" || x.v === "<<-") {
      const y = t[++i];

      if (!y || y.op) {
        return bad("EINVAL", `${x.v}: missing delimiter`);
      }

      cmd.redir.push({
        fd: 0,
        mode: "here",
        path: { v: y.v, q: y.q },
        body: "",
        stripTabs: x.v === "<<-",
        expand: !y.q,
      });

      continue;
    }

    if (["<", ">", ">>", "2>", "2>>"].includes(x.v)) {
      const y = t[++i];
      if (!y || y.op) return bad("EINVAL", `${x.v}: missing path`);
      const fd = x.v.startsWith("2") ? 2 : x.v === "<" ? 0 : 1;
      const mode = x.v === "<" ? "r" : x.v.endsWith(">>") ? "a" : "w";
      cmd.redir.push({ fd, mode, path: { v: y.v, q: y.q } });
      continue;
    }
    if (x.v === "|") { pcmd(); continue; }
    if (x.v === "&") { punit(true); gate = ";"; continue; }
    if (x.v === ";" || x.v === "&&" || x.v === "||") {
      punit(false);
      gate = x.v;
      continue;
    }
    bad("EINVAL", `unexpected ${x.v}`);
  }
  if (cmd.words.length || pipe.length) punit(false);
  return out;
};
