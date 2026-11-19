import { hostModule } from "./host-module.js";
import { parseJson, type Json } from "../core/json.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import type { AccountConfig, LocalSessionConfig, SystemConfig } from "../core/config.js";

const obj = (x: Json): Record<string, Json> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, Json> : {};
const own = (x: Record<string, Json>, key: string): boolean => Object.prototype.hasOwnProperty.call(x, key);
const str = (x: Json, d: string): string => typeof x === "string" ? x : d;
const nat = (x: Json, d: number): number => Number.isSafeInteger(x) && Number(x) >= 0 ? Number(x) : d;
const nums = (x: Json, d: number[]): number[] => Array.isArray(x) && x.every(n => Number.isSafeInteger(n) && Number(n) >= 0) ? x.map(Number) : [...d];
const accountName = (x: Json): string | null => {
  if (typeof x !== "string" || x.length === 0 || x.length > 255) return null;
  return /^[A-Za-z_][A-Za-z0-9_.-]*\$?$/.test(x) ? x : null;
};

const overlayConfig = (
  base: Json,
  override: Json,
): Json => {
  const left = obj(base);
  const right = obj(override);
  const merged: Record<string, Json> = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const prior = (merged[key] ?? null);

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

const account = (x: Json, d: AccountConfig): AccountConfig => {
  const a = obj(x), c = obj((a.cred ?? null));
  const duid = d.cred.uid ?? d.cred.euid ?? d.cred.ruid ?? 0;
  const dgid = d.cred.gid ?? d.cred.egid ?? d.cred.rgid ?? 0;
  return {
    name: str((a.name ?? null), d.name),
    displayName: str((a.displayName ?? null), d.displayName),
    home: str((a.home ?? null), d.home),
    shell: str((a.shell ?? null), d.shell),
    cred: {"ruid": null, "euid": null, "suid": null, "rgid": null, "egid": null, "sgid": null, uid: nat((c.uid ?? null), duid),
      gid: nat((c.gid ?? null), dgid),
      groups: nums((c.groups ?? null), d.cred.groups),
    },
  };
};

const localSession = (x: Json, d: LocalSessionConfig): LocalSessionConfig => {
  const q = obj(x);
  const mode = (q.mode ?? null) === "login" ? "login" : (q.mode ?? null) === "direct" ? "direct" : d.mode;
  const selected = accountName((q.account ?? null));
  return {
    mode,
    account: mode === "login" ? selected : null,
  };
};

export const mergeConfig = (x: Json): SystemConfig => {
  const q = obj(x);
  const legacy = !own(q, "kernel") && own(q, "distro");
  const legacyKernel = obj((q.os ?? null));
  const kernel = obj(legacy ? (q.os ?? null) : (q.kernel ?? null));
  const os = obj(legacy ? (q.distro ?? null) : (q.os ?? null));
  const terminal = obj((q.terminal ?? null)), accounts = obj((q.accounts ?? null)), sessions = obj((q.sessions ?? null)), messages = obj((q.messages ?? null)), author = obj((q.author ?? null));
  const d = DEFAULT_CONFIG;
  return {
    kernel: {
      name: str((kernel.name ?? null), d.kernel.name),
      prettyName: str((kernel.prettyName ?? null), d.kernel.prettyName),
      id: str((kernel.id ?? null), d.kernel.id),
      version: str((kernel.version ?? null), d.kernel.version),
      machine: str((kernel.machine ?? null), d.kernel.machine),
    },
    os: {
      name: str((os.name ?? null), d.os.name),
      prettyName: str((os.prettyName ?? null), d.os.prettyName),
      id: str((os.id ?? null), d.os.id),
      version: str((os.version ?? null), d.os.version),
      homeUrl: str(
        legacy ? (legacyKernel.homeUrl ?? null) : (os.homeUrl ?? null),
        d.os.homeUrl,
      ),
    },
    hostName: str((q.hostName ?? null), d.hostName),
    terminal: {
      term: str((terminal.term ?? null), d.terminal.term),
      lang: str((terminal.lang ?? null), d.terminal.lang),
    },
    accounts: {
      cli: account((accounts.cli ?? null), d.accounts.cli),
      web: account((accounts.web ?? null), d.accounts.web),
    },
    sessions: {
      local: localSession((sessions.local ?? null), d.sessions.local),
    },
    messages: {
      tetoBanner: str(
        (messages.tetoBanner ?? null),
        d.messages.tetoBanner,
      ),
      motd: str((messages.motd ?? null), d.messages.motd),
      issue: str((messages.issue ?? null), d.messages.issue),
      guestReadme: str((messages.guestReadme ?? null), d.messages.guestReadme),
      halted: str((messages.halted ?? null), d.messages.halted),
    },
    author: {
      name: str((author.name ?? null), d.author.name),
      url: str((author.url ?? null), d.author.url),
    },
  };
};

interface ReadFs { readFile(p: string | URL, enc: string): Promise<string>; }

export const hostConfig = async (
  at: URL | null = null,
): Promise<SystemConfig> => {
  const fs = await hostModule("node:fs/promises");

  if (at) {
    try {
      return mergeConfig(
        parseJson(await fs.readFile(at, "utf8")),
      );
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  let source: Json = {};
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
        parseJson(await fs.readFile(file, "utf8")),
      );
      loaded = true;
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
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
  at: string | URL | null = null,
): Promise<SystemConfig> => {
  const base = at instanceof URL
    ? at
    : new URL(at ?? ".", document.baseURI);

  let source: Json = {};
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
        parseJson(await response.text()),
      );

      loaded = true;
    // This documented best-effort fallback intentionally continues after the optional operation fails.
    //@cg-expect-warning
    } catch {
      /* Missing optional configuration layer. */
    }
  }

  return loaded
    ? mergeConfig(source)
    : DEFAULT_CONFIG;
};
