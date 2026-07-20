export const IDENTITY = {
  os: {
    name: "mikuOS",
    prettyName: "初音ミクOS v｡三",
    version: "0.3",
    expansion: "MIKU Is Not the Kernel; it's Userspace.",
  },
  thistle: {
    name: "Thistle",
    expansion: "Thistle Hosted Interactive Shell-based TypeScript Live Environment.",
    role: "sole authoritative human-written TypeScript kernel source",
  },
  teto: {
    name: "Teto",
    expansion: "Teto Executes Thistle Optimally.",
    role: "generated optimised WebAssembly form of Thistle",
  },
  guest: {
    architecture: "Thistle64 RV64GC",
    executable: "THX",
  },
} as const;

