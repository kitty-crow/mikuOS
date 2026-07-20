// MIKUOS_KEY_PREFS_V1
// Symbolic terminal key bindings shared by local and web line editors.

const sequences = new Map<string, readonly string[]>([
  ["tab", ["\t"]],
  ["shift+tab", ["\x1b[Z"]],
  ["enter", ["\r", "\n"]],
  ["escape", ["\x1b"]],
  ["backspace", ["\x7f", "\b"]],
  ["delete", ["\x1b[3~"]],
  ["home", ["\x1b[H", "\x1b[1~"]],
  ["end", ["\x1b[F", "\x1b[4~"]],
  ["up", ["\x1b[A"]],
  ["down", ["\x1b[B"]],
  ["left", ["\x1b[D"]],
  ["right", ["\x1b[C"]],

  // Standard xterm Alt is modifier 3. Some host terminal profiles,
  // including the one used while implementing this milestone, report
  // physical Alt+Arrow as modifier 5. Both encodings are accepted.
  ["alt+up", ["\x1b[1;3A", "\x1b[3A", "\x1b\x1b[A", "\x1b[1;5A"]],
  ["alt+down", ["\x1b[1;3B", "\x1b[3B", "\x1b\x1b[B", "\x1b[1;5B"]],
  ["alt+right", ["\x1b[1;3C", "\x1b[3C", "\x1b\x1b[C", "\x1b[1;5C"]],
  ["alt+left", ["\x1b[1;3D", "\x1b[3D", "\x1b\x1b[D", "\x1b[1;5D"]],

  ["ctrl+up", ["\x1b[1;5A"]],
  ["ctrl+down", ["\x1b[1;5B"]],
  ["ctrl+right", ["\x1b[1;5C"]],
  ["ctrl+left", ["\x1b[1;5D"]],
  ["ctrl+a", ["\x01"]],
  ["ctrl+b", ["\x02"]],
  ["ctrl+c", ["\x03"]],
  ["ctrl+d", ["\x04"]],
  ["ctrl+e", ["\x05"]],
  ["ctrl+f", ["\x06"]],
  ["ctrl+g", ["\x07"]],
  ["ctrl+h", ["\x08"]],
  ["ctrl+k", ["\x0b"]],
  ["ctrl+l", ["\x0c"]],
  ["ctrl+r", ["\x12"]],
  ["ctrl+s", ["\x13"]],
  ["ctrl+u", ["\x15"]],
  ["ctrl+w", ["\x17"]],
]);

const aliases = new Map<string, string>([
  ["esc", "escape"],
  ["return", "enter"],
  ["shift-tab", "shift+tab"],
  ["alt-up", "alt+up"],
  ["alt-down", "alt+down"],
  ["alt-left", "alt+left"],
  ["alt-right", "alt+right"],
]);

const normalise = (name: string): string => {
  const compact = name.trim().toLowerCase().replace(/\s+/g, "");
  return aliases.get(compact) ?? compact;
};

const hexSequence = (name: string): string | undefined => {
  const match = /^hex:(.*)$/i.exec(name.trim());
  if (!match) return undefined;

  const value = match[1]!.replace(/(?:0x|[^0-9a-f])/gi, "");
  if (!value || value.length % 2 !== 0) return undefined;

  const bytes: number[] = [];
  for (let at = 0; at < value.length; at += 2) {
    bytes.push(Number.parseInt(value.slice(at, at + 2), 16));
  }

  return String.fromCharCode(...bytes);
};

export const bindingNames = (binding: string): string[] =>
  binding.split(",").map(value => value.trim()).filter(Boolean);

export const keySequences = (name: string): readonly string[] => {
  const raw = hexSequence(name);
  if (raw !== undefined) return [raw];
  return sequences.get(normalise(name)) ?? [];
};

export const keyMatches = (input: string, binding: string): boolean =>
  bindingNames(binding).some(name => keySequences(name).includes(input));

export const keyBindingWarnings = (binding: string): string[] => {
  const warnings: string[] = [];
  for (const name of bindingNames(binding)) {
    if (keySequences(name).length) continue;
    warnings.push(`unknown key name ${JSON.stringify(name)}`);
  }
  return warnings;
};
