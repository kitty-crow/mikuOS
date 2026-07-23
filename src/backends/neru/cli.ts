import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface NeruCliRequest {
  output?: string;
  variant?: "wasm32_nommu" | "wasm64_nommu";
  rebuildLinux: boolean;
  skipBuild: boolean;
}

const option = (argv: readonly string[], name: string): string | undefined => {
  const joined = argv.find(value => value.startsWith(`${name}=`));
  if (joined) return joined.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

export const requestedKernel = (
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined => {
  const joined = argv.find(value => value.startsWith("--kernel="));
  if (joined) return joined.slice("--kernel=".length);
  const index = argv.indexOf("--kernel");
  return index >= 0 ? argv[index + 1] : environment.MIKUOS_KERNEL;
};

export const neruCliRequest = (
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): NeruCliRequest | undefined => {
  const kernel = requestedKernel(argv, environment);
  if (kernel !== "neru" && kernel !== "linux") return undefined;
  const variant = option(argv, "--neru-variant") ?? environment.NERU_LINUX_VARIANT;
  if (variant && variant !== "wasm32_nommu" && variant !== "wasm64_nommu") {
    throw new Error(`Unsupported NERU variant: ${variant}`);
  }
  const output = option(argv, "--neru-output") ?? environment.NERU_ARTIFACT_ROOT;
  return {
    ...(output ? { output } : {}),
    ...(variant ? { variant } : {}),
    rebuildLinux: argv.includes("--neru-rebuild-linux"),
    skipBuild: argv.includes("--neru-skip-build"),
  };
};

export const neruCommand = (
  request: NeruCliRequest,
  bunExecutable = process.execPath,
): { executable: string; argv: string[] } => {
  const root = new URL("../../../", import.meta.url);
  const launcher = fileURLToPath(new URL("neru/neru.ts", root));
  const userland = fileURLToPath(new URL(".thistle.base/", root));
  const output = request.output ?? fileURLToPath(new URL("build/neru/", root));
  const argv = ["run", launcher, "--userland", userland, "--output", output, "--boot"];
  if (request.variant) argv.push("--variant", request.variant);
  if (request.rebuildLinux) argv.push("--rebuild-linux");
  if (request.skipBuild) argv.push("--skip-build");
  return { executable: bunExecutable, argv };
};

export const runNeruCli = async (request: NeruCliRequest): Promise<number> => {
  if (!(globalThis as { Bun?: unknown }).Bun) {
    throw new Error("--kernel=neru requires Bun for the ahead-of-time image build");
  }
  const command = neruCommand(request);
  return await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.argv, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code: number | null) => resolve(code ?? 1));
  });
};
