import type { Cred } from "../fs/vfs.js";
import { IDENTITY } from "./identity.js";

export interface AccountConfig {
  name: string;
  displayName: string;
  home: string;
  shell: string;
  cred: Cred;
}

export interface LocalSessionConfig {
  mode: "direct" | "login";
  account?: string;
}

export interface SystemConfig {
  kernel: {
    name: string;
    prettyName: string;
    id: string;
    version: string;
    machine: string;
  };
  os: {
    name: string;
    prettyName: string;
    id: string;
    version: string;
    homeUrl: string;
  };
  hostName: string;
  terminal: {
    term: string;
    lang: string;
  };
  accounts: {
    cli: AccountConfig;
    web: AccountConfig;
  };
  sessions: {
    local: LocalSessionConfig;
  };
  messages: {
    tetoBanner: string;
    motd: string;
    issue: string;
    guestReadme: string;
    halted: string;
  };
  author: {
    name: string;
    url: string;
  };
}

export const rootCred = (): Cred => ({
  uid: 0,
  gid: 0,
  ruid: 0,
  euid: 0,
  suid: 0,
  rgid: 0,
  egid: 0,
  sgid: 0,
  groups: [0],
});

export const guestCred = (): Cred => ({
  uid: 1000,
  gid: 1000,
  ruid: 1000,
  euid: 1000,
  suid: 1000,
  rgid: 1000,
  egid: 1000,
  sgid: 1000,
  groups: [1000],
});

export const DEFAULT_CONFIG: SystemConfig = {
  kernel: {
    name: IDENTITY.thistle.name,
    prettyName: IDENTITY.thistle.name,
    id: "thistle",
    version: "2.1.0",
    machine: IDENTITY.guest.architecture,
  },
  os: {
    name: "Thistle",
    prettyName: "Thistle development system",
    id: "thistle",
    version: "2.1.0",
    homeUrl: "https://kittycrow.dev",
  },
  hostName: "thistle",
  terminal: {
    term: "xterm-256color",
    lang: "en_GB.UTF-8",
  },
  accounts: {
    cli: {
      name: "root",
      displayName: "root",
      home: "/root",
      shell: "/bin/thsh",
      cred: rootCred(),
    },
    web: {
      name: "guest",
      displayName: "Guest",
      home: "/home/guest",
      shell: "/bin/thsh",
      cred: guestCred(),
    },
  },
  sessions: {
    local: { mode: "direct" },
  },
  messages: {
    tetoBanner: "",
    motd: "Welcome to the Thistle development system.\n",
    issue: "初音ミクOS v｡三 \\n \\l\n",
    guestReadme: "This browser/local guest account is unprivileged. Your home is writable.\n",
    halted: "\r\nThistle halted.\r\n",
  },
  author: {
    name: "Kitty Crow",
    url: "https://kittycrow.dev",
  },
};
