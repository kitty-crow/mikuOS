import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface NeruCliRequest {
  root: string;
  output?: string;
  endpoint?: string;
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
  if (argv.includes("--no-root")) {
    throw new Error("--kernel=neru requires the same persistent root used by Thistle and Teto");
  }

  const variantValue = option(argv, "--neru-variant") ?? environment.NERU_LINUX_VARIANT;
  let variant: NeruCliRequest["variant"];
  if (variantValue !== undefined) {
    if (variantValue !== "wasm32_nommu" && variantValue !== "wasm64_nommu") {
      throw new Error(`Unsupported NERU variant: ${variantValue}`);
    }
    variant = variantValue;
  }

  const projectRoot = new URL("../../../", import.meta.url);
  const root = option(argv, "--root")
    ?? environment.MIKUOS_ROOT
    ?? environment.THISTLE_ROOT
    ?? fileURLToPath(new URL(".thistle/", projectRoot));
  const output = option(argv, "--neru-output") ?? environment.NERU_ARTIFACT_ROOT;
  const endpoint = option(argv, "--neru-fs-endpoint") ?? environment.NERU_FS_ENDPOINT;
  return {
    root,
    ...(output !== undefined ? { output } : {}),
    ...(endpoint !== undefined ? { endpoint } : {}),
    ...(variant !== undefined ? { variant } : {}),
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
  const output = request.output ?? fileURLToPath(new URL("build/neru-runtime/", root));
  const argv = [
    "run",
    launcher,
    "--fs-root",
    request.root,
    "--output",
    output,
    "--boot",
  ];
  if (request.endpoint) argv.push("--fs-endpoint", request.endpoint);
  if (request.variant) argv.push("--variant", request.variant);
  if (request.rebuildLinux) argv.push("--rebuild-linux");
  if (request.skipBuild) argv.push("--skip-build");
  return { executable: bunExecutable, argv };
};

export const runNeruCli = async (request: NeruCliRequest): Promise<number> => {
  if (!(globalThis as { Bun?: unknown }).Bun) {
    throw new Error("--kernel=neru requires Bun for the Linux-WASM host runtime");
  }
  const command = neruCommand(request);
  return await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.argv, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code: number | null) => resolve(code ?? 1));
  });
};
