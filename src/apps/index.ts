import type { Kern } from "../core/kernel.js";
import { KErr } from "../core/err.js";
import type { Cred } from "../fs/vfs.js";
import { BaseName, Cat, Chmod, Chown, Cp, DirName, Find, Ln, Ls, Mkdir, Mv, Pwd, Readlink, Rm, Rmdir, StatApp, Touch } from "./fs.js";
import { Base64, Cut, Echo, Grep, Head, Printf, Sed, Seq, Sort, Strings, Tail, Tee, Tr, Uniq, Wc, Yes } from "./text.js";
import { Kill, Ps, Sleep, Time } from "./proc.js";
import { Clear, DateApp, Df, Dmesg, Env, Expr, FalseApp, FileApp, Free, Help, Hostname, Id, Mount, PrintEnv, TestApp, Thsh, TrueApp, Uname, Uptime, Wasm, Which, Whoami } from "./sys.js";
import { Wget } from "./net.js";
import { AsApp, DisApp, Elf2ThxApp, LdApp, NmApp, ObjdumpApp, SizeApp } from "./asm.js";

const root: Cred = {
  uid: 0,
  gid: 0,
  ruid: 0,
  euid: 0,
  suid: 0,
  rgid: 0,
  egid: 0,
  sgid: 0,
  groups: [0],
};

export const BUILTIN_RESCUE_ROOT = "/usr/libexec/mikuos/builtin";
export const BUILTIN_MANIFEST = "/usr/share/mikuos/builtin-commands.json";
export const COMPILER_MANIFEST = "/usr/share/mikuos/compiler-infrastructure.json";

const ensureDir = (k: Kern, path: string): void => {
  let current = "";

  for (const part of path.split("/").filter(Boolean)) {
    current += `/${part}`;

    try {
      const stat = k.fs.stat(current, "/", root);
      if (stat.kind !== "dir") throw new Error(`${current} is not a directory`);
    } catch (error) {
      if (!(error instanceof KErr) || error.code !== "ENOENT") throw error;
      k.fs.mkdir(current, "/", root, 0o755);
    }
  }
};

const writeRootFile = (
  k: Kern,
  path: string,
  data: string,
  mode: number,
  preserve = false,
): void => {
  try {
    if (preserve && k.fs.stat(path, "/", root).kind === "file") return;
    k.fs.write(path, data, "/", root, false, mode);
    k.fs.chmod(path, mode, "/", root);
    k.fs.chown(path, 0, 0, "/", root);
  } catch (error) {
    if (!(error instanceof KErr) || error.code !== "ENOENT") throw error;
    k.fs.mkfile(path, data, "/", root, mode);
  }
};

/**
 * Recreate the immutable rescue entry points and provenance manifests used by
 * the staged upstream-userland migration. Normal /bin names may later point to
 * native upstream programmes without making the original built-ins unreachable.
 */
export const refreshBuiltinRescues = (k: Kern): void => {
  ensureDir(k, BUILTIN_RESCUE_ROOT);
  ensureDir(k, "/usr/share/mikuos");
  ensureDir(k, "/var/lib/mikuos");

  const commands = [...k.apps.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(app => {
      const rescuePath = `${BUILTIN_RESCUE_ROOT}/${app.name}`;
      writeRootFile(k, rescuePath, `#!thistle:${app.name}\n`, 0o755);

      return {
        name: app.name,
        origin: "mikuOS",
        implementation: "TypeScript built-in",
        description: app.desc,
        usage: app.use,
        activePath: `/bin/${app.name}`,
        rescuePath,
        defaultProvider: "built-in",
      };
    });

  writeRootFile(
    k,
    BUILTIN_MANIFEST,
    `${JSON.stringify({ schema: 1, rescueRoot: BUILTIN_RESCUE_ROOT, commands }, null, 2)}\n`,
    0o644,
  );

  writeRootFile(
    k,
    COMPILER_MANIFEST,
    `${JSON.stringify({
      schema: 1,
      buildPolicy: "host cross-compile to static RV64GC LP64D musl ELF, then host elf2thx",
      integration: [
        {
          path: "/usr/libexec/thistle/thx-cc",
          origin: "mikuOS",
          implementation: "native compiler-driver wrapper",
          role: "select an upstream compiler and convert final static ELF output to THX2",
          migrationPolicy: "minimise; retain only the target integration and ELF-to-THX transition",
        },
        {
          path: "/bin/elf2thx",
          origin: "mikuOS",
          implementation: "TypeScript built-in",
          rescuePath: `${BUILTIN_RESCUE_ROOT}/elf2thx`,
          role: "THX2 format importer",
          migrationPolicy: "retain as mikuOS-specific infrastructure",
        },
      ],
      // Guest compilers are not shipped in the browser base.
      // mikuOS uses the host-only thistlecc build pipeline.
      publicDrivers: [],
    }, null, 2)}\n`,
    0o644,
  );

  writeRootFile(
    k,
    "/var/lib/mikuos/userland-overrides.json",
    `${JSON.stringify({ schema: 1, commands: {} }, null, 2)}\n`,
    0o644,
    true,
  );
};

export const apps = (k: Kern): void => {
  [
    new BaseName(), new Cat(), new Chmod(), new Chown(), new Cp(), new DirName(), new Find(), new Ln(), new Ls(), new Mkdir(), new Mv(), new Pwd(), new Readlink(), new Rm(), new Rmdir(), new StatApp(), new Touch(),
    new Base64(), new Cut(), new Echo(), new Grep(), new Head(), new Printf(), new Sed(), new Seq(), new Sort(), new Strings(), new Tail(), new Tee(), new Tr(), new Uniq(), new Wc(), new Yes(),
    new Kill(), new Ps(), new Sleep(), new Time(),
    new Wget(),
    new AsApp(), new LdApp(), new Elf2ThxApp(), new DisApp(), new ObjdumpApp(), new NmApp(), new SizeApp(),
    new Clear(), new DateApp(), new Df(), new Dmesg(), new Env(), new Expr(), new FalseApp(), new FileApp(), new Free(), new Help(), new Hostname(), new Id(), new Mount(), new PrintEnv(), new TestApp(), new TestApp("["), new Thsh(), new Thsh("sh"), new TrueApp(), new Uname(), new Uptime(), new Wasm(), new Which(), new Whoami(),
  ].forEach(app => k.install(app));

  refreshBuiltinRescues(k);
};
