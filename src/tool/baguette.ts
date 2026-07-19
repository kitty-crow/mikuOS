/**
 * Compatibility launcher for the historical src/tool/baguette.ts path.
 * The complete implementation lives in ../../baguette/src.
 */
export {};

interface WrapperProcess {
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  execPath: string;
  exit(code?: number): never;
}
interface BunCompat {
  spawnSync(
    command: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
      stdout: "inherit";
      stderr: "inherit";
    },
  ): { exitCode: number };
}

const processHost = (globalThis as unknown as { process: WrapperProcess }).process;
const nativeBun = (globalThis as unknown as { Bun?: BunCompat }).Bun;
const childProcess = await import("node:child_process" as string) as unknown as {
  spawnSync(
    executable: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
      stdio: "inherit";
    },
  ): { status: number | null };
};

const forwarded = processHost.argv.slice(2);
const command = nativeBun
  ? [processHost.execPath, "run", "baguette/src/compiler.ts", ...forwarded]
  : ["bun", "run", "baguette/src/compiler.ts", ...forwarded];
const exitCode = nativeBun
  ? nativeBun.spawnSync(command, {
      cwd: processHost.cwd(),
      env: processHost.env,
      stdout: "inherit",
      stderr: "inherit",
    }).exitCode
  : (childProcess.spawnSync(command[0]!, command.slice(1), {
      cwd: processHost.cwd(),
      env: processHost.env,
      stdio: "inherit",
    }).status ?? 1);

processHost.exit(exitCode);
