import { DEFAULT_CONFIG } from "../core/config.js";
import type { AccountConfig, LocalSessionConfig, SystemConfig } from "../core/config.js";

const obj = (x: unknown): Record<string, unknown> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
const own = (x: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(x, key);
const str = (x: unknown, d: string): string => typeof x === "string" ? x : d;
const nat = (x: unknown, d: number): number => Number.isSafeInteger(x) && Number(x) >= 0 ? Number(x) : d;
const nums = (x: unknown, d: number[]): number[] => Array.isArray(x) && x.every(n => Number.isSafeInteger(n) && Number(n) >= 0) ? x.map(Number) : [...d];
const accountName = (x: unknown): string | undefined => {
  if (typeof x !== "string" || x.length === 0 || x.length > 255) return undefined;
  return /^[A-Za-z_][A-Za-z0-9_.-]*\$?$/.test(x) ? x : undefined;
};

const overlayConfig = (
  base: unknown,
  override: unknown,
): unknown => {
  const left = obj(base);
  const right = obj(override);
  const merged: Record<string, unknown> = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const prior = merged[key];

    merged[key] =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prior &&
      typeof prior === "object" &&
      !Array.isArray(prior)
        ? overlayConfig(prior, value)
        : value;
  }

  return merged;
};

const account = (x: unknown, d: AccountConfig): AccountConfig => {
  const a = obj(x), c = obj(a.cred);
  const duid = d.cred.uid ?? d.cred.euid ?? d.cred.ruid ?? 0;
  const dgid = d.cred.gid ?? d.cred.egid ?? d.cred.rgid ?? 0;
  return {
    name: str(a.name, d.name),
    displayName: str(a.displayName, d.displayName),
    home: str(a.home, d.home),
    shell: str(a.shell, d.shell),
    cred: {
      uid: nat(c.uid, duid),
      gid: nat(c.gid, dgid),
      groups: nums(c.groups, d.cred.groups),
    },
  };
};

const localSession = (x: unknown, d: LocalSessionConfig): LocalSessionConfig => {
  const q = obj(x);
  const mode = q.mode === "login" ? "login" : q.mode === "direct" ? "direct" : d.mode;
  const selected = accountName(q.account);
  return {
    mode,
    ...(mode === "login" && selected ? { account: selected } : {}),
  };
};

export const mergeConfig = (x: unknown): SystemConfig => {
  const q = obj(x);
  const legacy = !own(q, "kernel") && own(q, "distro");
  const legacyKernel = obj(q.os);
  const kernel = obj(legacy ? q.os : q.kernel);
  const os = obj(legacy ? q.distro : q.os);
  const terminal = obj(q.terminal), accounts = obj(q.accounts), sessions = obj(q.sessions), messages = obj(q.messages), author = obj(q.author);
  const d = DEFAULT_CONFIG;
  return {
    kernel: {
      name: str(kernel.name, d.kernel.name),
      prettyName: str(kernel.prettyName, d.kernel.prettyName),
      id: str(kernel.id, d.kernel.id),
      version: str(kernel.version, d.kernel.version),
      machine: str(kernel.machine, d.kernel.machine),
    },
    os: {
      name: str(os.name, d.os.name),
      prettyName: str(os.prettyName, d.os.prettyName),
      id: str(os.id, d.os.id),
      version: str(os.version, d.os.version),
      homeUrl: str(
        legacy ? legacyKernel.homeUrl : os.homeUrl,
        d.os.homeUrl,
      ),
    },
    hostName: str(q.hostName, d.hostName),
    terminal: {
      term: str(terminal.term, d.terminal.term),
      lang: str(terminal.lang, d.terminal.lang),
    },
    accounts: {
      cli: account(accounts.cli, d.accounts.cli),
      web: account(accounts.web, d.accounts.web),
    },
    sessions: {
      local: localSession(sessions.local, d.sessions.local),
    },
    messages: {
      tetoBanner: str(
        messages.tetoBanner,
        d.messages.tetoBanner,
      ),
      motd: str(messages.motd, d.messages.motd),
      issue: str(messages.issue, d.messages.issue),
      guestReadme: str(messages.guestReadme, d.messages.guestReadme),
      halted: str(messages.halted, d.messages.halted),
    },
    author: {
      name: str(author.name, d.author.name),
      url: str(author.url, d.author.url),
    },
  };
};

interface ReadFs { readFile(p: string | URL, enc: string): Promise<string>; }

export const hostConfig = async (
  at?: URL,
): Promise<SystemConfig> => {
  const fs = await import(
    "node:fs/promises" as string
  ) as unknown as ReadFs;

  if (at) {
    try {
      return mergeConfig(
        JSON.parse(await fs.readFile(at, "utf8")),
      );
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  let source: unknown = {};
  let loaded = false;

  /*
   * mikuos.config.json supplies the base operating-system configuration.
   * thistle.config.json is then applied as the kernel/runtime override.
   */
  for (const file of [
    new URL("../../mikuos.config.json", import.meta.url),
    new URL("../../thistle.config.json", import.meta.url),
  ]) {
    try {
      source = overlayConfig(
        source,
        JSON.parse(await fs.readFile(file, "utf8")),
      );
      loaded = true;
    } catch {
      /* Missing optional configuration layer. */
    }
  }

  return loaded
    ? mergeConfig(source)
    : DEFAULT_CONFIG;
};

/** Loads only deployable static files and never probes a runtime service. */
export const staticBrowserConfig = async (
  at?: string | URL,
): Promise<SystemConfig> => {
  const base = at instanceof URL
    ? at
    : new URL(at ?? ".", document.baseURI);

  let source: unknown = {};
  let loaded = false;

  for (const name of [
    "mikuos.config.json",
    "thistle.config.json",
  ]) {
    try {
      const response = await fetch(
        new URL(name, base),
        { cache: "no-store" },
      );

      if (!response.ok) continue;

      source = overlayConfig(
        source,
        await response.json(),
      );

      loaded = true;
    } catch {
      /* Missing optional configuration layer. */
    }
  }

  return loaded
    ? mergeConfig(source)
    : DEFAULT_CONFIG;
};
