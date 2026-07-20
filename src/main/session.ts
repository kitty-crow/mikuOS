import type { AccountConfig, LocalSessionConfig, SystemConfig } from "../core/config.js";

export interface LocalSessionPlan {
  kind: "direct" | "login";
  account: AccountConfig;
  command?: string;
}

export interface Supervisor {
  live(): boolean;
  run(command: string): Promise<number>;
  unavailable(): void;
}

const shellSafeAccount = (name: string): boolean =>
  /^[A-Za-z_][A-Za-z0-9_.-]*\$?$/.test(name);

const accountByName = (config: SystemConfig, name?: string): AccountConfig => {
  if (name === config.accounts.web.name) return config.accounts.web;
  if (name === config.accounts.cli.name) return config.accounts.cli;
  return { ...config.accounts.web, name: name ?? config.accounts.web.name };
};

export const localSessionPlan = (config: SystemConfig): LocalSessionPlan => {
  const session: LocalSessionConfig = config.sessions.local;
  if (session.mode !== "login") {
    return { kind: "direct", account: config.accounts.cli };
  }
  if ((config.accounts.cli.cred.euid ?? config.accounts.cli.cred.uid ?? 0) !== 0) {
    throw new Error("local login mode requires the CLI supervisor to run with UID 0");
  }
  const account = accountByName(config, session.account);
  const command = session.account && shellSafeAccount(session.account)
    ? `/bin/login ${session.account}`
    : "/bin/login";
  return { kind: "login", account: config.accounts.cli, command };
};

export const superviseLocalLogin = async (
  plan: LocalSessionPlan,
  supervisor: Supervisor,
): Promise<void> => {
  const command = plan.command;
  if (!command) return;
  while (supervisor.live()) {
    const code = await supervisor.run(command);
    if (code === 127) {
      supervisor.unavailable();
      return;
    }
  }
};
