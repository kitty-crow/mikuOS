import type { Cred } from "../fs/vfs.js";

export interface AccountConfig {
  name: string;
  displayName: string;
  home: string;
  shell: string;
  cred: Cred;
}

export interface SystemConfig {
  os: {
    name: string;
    prettyName: string;
    id: string;
    version: string;
    release: string;
    machine: string;
    homeUrl: string;
  };
  distro: {
    name: string;
    prettyName: string;
    id: string;
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
  messages: {
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

export const DEFAULT_CONFIG: SystemConfig = {
  os: {
    name: "Thistle",
    prettyName: "Thistle OS",
    id: "thistle",
    version: "2.1.0",
    release: "2.1.0-thistle",
    machine: "Thistle64 RV64GC",
    homeUrl: "https://kittycrow.dev",
  },
  distro: {
    name: "HatsuneMiku OS",
    prettyName: "初音ミクOS",
    id: "hatsunemiku",
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
      cred: { uid: 0, gid: 0, groups: [0] },
    },
    web: {
      name: "guest",
      displayName: "Web Guest",
      home: "/home/guest",
      shell: "/bin/thsh",
      cred: { uid: 1000, gid: 1000, groups: [1000] },
    },
  },
  messages: {
    motd: "Welcome to Thistle 2.1.0, the 64-bit TypeScript Unix-like system.\nRun 'hello.txe', or compile C and C++ with tcc, clang, and gcc. Run 'help' for userland.\n",
    issue: "Thistle OS 2.1.0 \\n \\l\n",
    guestReadme: "Your home is writable; the rest of the system still has opinions.\n",
    halted: "\nSession halted. Reload the page to start again.\n",
  },
  author: {
    name: "Kitty Crow",
    url: "https://kittycrow.dev",
  },
};
