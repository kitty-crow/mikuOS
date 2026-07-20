import { bad, KErr } from "../core/err.js";
import type { Kern } from "../core/kernel.js";
import type { Cred } from "../fs/vfs.js";
import { Dir } from "../fs/vfs.js";
import { dec, enc } from "../io/stream.js";
import { apps, refreshBuiltinRescues } from "../apps/index.js";
import { demoWasm } from "../wasm/demo.js";
import { Asm } from "../asm/asm.js";
import { Link } from "../asm/link.js";
import { codec } from "../asm/fmt.js";
import { CRT032_TAS, CRT0_TAS, FIB_TAS, HELLO32_TAS, HELLO_TAS, SYS32_TAS, SYS_TAS } from "../asm/lib.js";

const r: Cred = { uid: 0, gid: 0, ruid: 0, euid: 0, suid: 0, rgid: 0, egid: 0, sgid: 0, groups: [0] };

export const ROOT_IMAGE_VERSION = 5;

const osRelease = (k: Kern): string => {
  const config = k.config;
  return `NAME="${config.os.name}"\nPRETTY_NAME="${config.os.prettyName}"\nVERSION="v${config.os.version}"\nVERSION_ID="${config.os.version}"\nID=${config.os.id}\nKERNEL_NAME=${config.kernel.name}\nKERNEL_VERSION=${config.kernel.version}\nKERNEL_SOURCE=Thistle\nHOME_URL="${config.os.homeUrl}"\n`;
};

const replaceStockFile = (k: Kern, path: string, oldText: string, newText: string): void => {
  let text: string;
  try { text = k.fs.read(path, "/", r); }
  catch (error) {
    if (error instanceof KErr && error.code === "ENOENT") return;
    throw error;
  }
  if (text === oldText) k.fs.write(path, newText, "/", r);
};

const addStockLink = (k: Kern, target: string, path: string): void => {
  try { k.fs.stat(path, "/", r); }
  catch (error) {
    if (!(error instanceof KErr) || error.code !== "ENOENT") throw error;
    try { k.fs.stat(target, "/", r); }
    catch { return; }
    k.fs.symlink(target, path, "/", r);
  }
};

const addStockFile = (k: Kern, path: string, text: string, mode = 0o644): void => {
  try { k.fs.stat(path, "/", r); }
  catch (error) {
    if (!(error instanceof KErr) || error.code !== "ENOENT") throw error;
    k.fs.mkfile(path, text, "/", r, mode);
  }
};

/** Apply only exact-match stock migrations; missing and user-edited files win. */
export const migrateImage = (k: Kern, from: number): number => {
  // Preserve the mature mikuOS 0.2 userspace while migrating only exact-match
  // stock identity files to the canonical mikuOS 0.3 naming. Local branding
  // and user-edited files remain authoritative.
  if (from < ROOT_IMAGE_VERSION) {
    replaceStockFile(k, "/etc/issue", "HatsuneMiku OS 2.1.0 \\n \\l\n", k.config.messages.issue);
    replaceStockFile(
      k,
      "/etc/os-release",
      "NAME=\"HatsuneMiku OS\"\nPRETTY_NAME=\"初音ミクOS\"\nID=hatsunemiku\nVERSION=2.1.0\nVERSION_ID=2.1.0\nKERNEL_NAME=Thistle\nKERNEL_PRETTY_NAME=\"Thistle Kernel\"\nHOME_URL=\"https://kittycrow.dev\"\n",
      osRelease(k),
    );
    replaceStockFile(
      k,
      "/etc/motd",
      "Welcome to HatsuneMiku OS 2.1.0, the 64-bit TypeScript Unix-like system.\nBased on the Thistle Kernel, HatsuneMiku OS is a free and open-source operating system for the web.\n",
      k.config.messages.motd,
    );
    replaceStockFile(
      k,
      "/boot/thistle.yaml",
      "name: Thistle\ndistro: HatsuneMiku OS\ndistro_display: 初音ミクOS\nrelease: 2.1.0\nkernel: user-space\nabi: [thistle64, thistle32-compat, rv64gc, wasi_snapshot_preview1]\nnative: [as, ld, dis, nm, size, tcc, clang, gcc]\ntoolchain: 2.1.0-r2\nnetwork: http-fetch\nauthor: Kitty Crow\nhome: https://kittycrow.dev\n",
      bootManifest(k),
    );
    addStockFile(k, "/boot/mikuos.yaml", bootManifest(k));
  }
  if (from < 1) {
    replaceStockFile(k, "/etc/issue", "Thistle OS 2.0.0 \\n \\l\n", k.config.messages.issue);
    replaceStockFile(
      k,
      "/etc/os-release",
      "NAME=Thistle\nVERSION=2.0.0\nVERSION_ID=2.0.0\nID=thistle\nPRETTY_NAME=\"Thistle OS 2.0.0\"\nHOME_URL=\"https://example.invalid/thistle\"\n",
      osRelease(k),
    );
  }
  if (from < 2) {
    replaceStockFile(
      k,
      "/etc/motd",
      "Welcome to Thistle 2.0.0, the 64-bit TypeScript Unix-like system.\nRun 'hello.txe' for Thistle64, 'hello32.txe' for compatibility, or 'help'.\n",
      k.config.messages.motd,
    );
  }
  if (from < 3) {
    replaceStockFile(
      k,
      "/etc/os-release",
      `NAME="${k.config.os.name}"\nPRETTY_NAME="${k.config.os.prettyName}"\nVERSION="v${k.config.os.version}"\nVERSION_ID="${k.config.os.version}"\nID=${k.config.os.id}\nKERNEL_NAME=${k.config.kernel.name}\nKERNEL_VERSION=${k.config.kernel.version}\nHOME_URL="${k.config.os.homeUrl}"\n`,
      osRelease(k),
    );
    replaceStockFile(
      k,
      "/etc/motd",
      "Welcome to mikuOS v0.3 on the Thistle 2.1.0 kernel.\nRun 'hello.txe', or compile on the host with thistlecc. Run 'help' for userland.\n",
      k.config.messages.motd,
    );
    replaceStockFile(
      k,
      "/boot/thistle.yaml",
      "name: Thistle\nrelease: 2.0.0\nkernel: user-space\nabi: [thistle64, thistle32-compat, wasi_snapshot_preview1]\nnative: [as, ld, dis, nm, size]\nnetwork: http-fetch\n",
      bootManifest(k),
    );
    addStockLink(k, "/usr/bin/hello.txe", "/usr/bin/hello.thx");
    addStockLink(k, "/usr/bin/hello.txe", "/usr/bin/hello.39");
    addStockLink(k, "/usr/bin/hello.thx", "/bin/hello.thx");
    addStockLink(k, "/usr/bin/hello.39", "/bin/hello.39");
  }
  if (from < 4) {
    replaceStockFile(
      k,
      "/etc/motd",
      "Welcome to mikuOS v0.3 on the direct Thistle 2.1.0 kernel.\nRun 'hello.txe', or compile on the host with thistlecc. Run 'help' for userland.\n",
      k.config.messages.motd,
    );
  }
  if (from < 5) {
    refreshBuiltinRescues(k);
  }
  return ROOT_IMAGE_VERSION;
};

const bootManifest = (k: Kern): string => {
  const config = k.config;
  return `os_name: ${config.os.name}\nos_release: v${config.os.version}\nkernel_name: ${k.name}\nkernel_source: Thistle\nkernel_release: ${k.release}\nmachine: ${config.kernel.machine}\nhost_compiler: thistlecc\nbuild_policy: host-only-thistlecc\n`;
};

export const identity = (k: Kern, overwrite = true): void => {
  const f = (p: string, x: string, mode = 0o644): void => {
    try {
      if (!overwrite && k.fs.stat(p, "/", r).kind === "file") return;
      k.fs.write(p, x, "/", r, false, mode);
      k.fs.chmod(p, mode, "/", r);
    } catch {
      k.fs.mkfile(p, x, "/", r, mode);
    }
  };
  const config = k.config;
  f("/etc/hostname", `${config.hostName}\n`);
  f("/etc/issue", config.messages.issue);
  f("/etc/motd", config.messages.motd);
  f("/etc/os-release", osRelease(k));
  const boot = bootManifest(k);
  f("/boot/mikuos.yaml", boot);
  f("/boot/thistle.yaml", boot);
};

export const image = (k: Kern): void => {
  const d = (p: string, mode = 0o755): void => { k.fs.mkdir(p, "/", r, mode); };
  const f = (p: string, x: string | Uint8Array, mode = 0o644): void => { k.fs.mkfile(p, x, "/", r, mode); };

  for (const p of ["/bin", "/boot", "/dev", "/etc", "/home", "/proc", "/root", "/run", "/sbin", "/tmp", "/usr", "/var"]) d(p, p === "/tmp" ? 0o777 : p === "/root" ? 0o700 : 0o755);
  for (const p of ["/etc/default", "/etc/skel", "/home/guest", "/proc/net", "/usr/bin", "/usr/include", "/usr/lib", "/usr/libexec", "/usr/libexec/mikuos", "/usr/libexec/mikuos/builtin", "/usr/sbin", "/usr/share", "/usr/share/licenses", "/usr/share/mikuos", "/var/lib", "/var/lib/mikuos", "/var/log", "/var/spool", "/var/spool/mail", "/var/tmp"]) d(p, p.includes("tmp") ? 0o777 : 0o755);
  for (const p of ["/usr/include/thistle", "/usr/include/thistle32", "/usr/lib/thistle", "/usr/lib/thistle32", "/usr/share/thistle", "/usr/share/thistle/examples"]) d(p);
  k.fs.chown("/home/guest", 1000, 1000, "/", r);

  f("/etc/passwd", "root:x:0:0:root:/root:/bin/thsh\nguest:x:1000:1000:Guest:/home/guest:/bin/thsh\n");
  f("/etc/group", "root:x:0:\nusers:x:1000:guest\n");
  f("/etc/shadow", "root:!:19723:0:99999:7:::\nguest:!:19723:0:99999:7:::\n", 0o600);
  f("/etc/gshadow", "root:!::\nusers:!::guest\n", 0o600);
  f("/etc/hosts", "127.0.0.1 localhost thistle\n::1 localhost thistle\n");
  f("/etc/fstab", "hostfs / thistlefs rw 0 0\nproc /proc procfs ro 0 0\ndev /dev devfs rw 0 0\n");
  f("/etc/profile", "export PATH=/bin:/usr/bin:/sbin:/usr/sbin\nexport LANG=en_GB.UTF-8\n");
  f("/root/readme.txt", "This home belongs to root. Try the pipelines in /usr/share/examples.thsh.\n", 0o600);
  f("/home/guest/readme.txt", k.config.messages.guestReadme, 0o644);
  k.fs.chown("/home/guest/readme.txt", 1000, 1000, "/", r);
  f("/usr/share/examples.thsh", "#!/bin/thsh\necho 'three one two two' | tr ' ' '\\n' | sort | uniq -c\nmkdir -p /tmp/thistle-demo\necho 'written through a redirect' > /tmp/thistle-demo/note\ncat /tmp/thistle-demo/note\n", 0o755);
  f("/usr/include/thistle/sys.tas", SYS_TAS);
  f("/usr/include/thistle32/sys.tas", SYS32_TAS);
  f("/usr/lib/thistle/crt0.tas", CRT0_TAS);
  f("/usr/lib/thistle32/crt0.tas", CRT032_TAS);
  f("/usr/share/thistle/examples/hello.tas", HELLO_TAS);
  f("/usr/share/thistle/examples/hello32.tas", HELLO32_TAS);
  f("/usr/share/thistle/examples/fib.tas", FIB_TAS);
  identity(k);

  apps(k);
  k.fs.symlink("/bin/thsh", "/bin/-sh", "/", r);
  f("/usr/bin/hello.wasm", demoWasm(), 0o755);
  k.fs.symlink("/usr/bin/hello.wasm", "/bin/hello.wasm", "/", r);
  const inc = (name: string): { src: string; file: string } => ({ src: k.fs.read(name, "/", r), file: name });
  const crt = new Asm(inc, { debug: true }).run(CRT0_TAS, "/usr/lib/thistle/crt0.tas").obj;
  f("/usr/lib/thistle/crt0.to", codec.pack(crt));
  const crt32 = new Asm(inc, { debug: true, arch: "thistle32" }).run(CRT032_TAS, "/usr/lib/thistle32/crt0.tas").obj;
  f("/usr/lib/thistle32/crt0.to", codec.pack(crt32));
  for (const [name, src] of [["hello", HELLO_TAS], ["fib", FIB_TAS]] as const) {
    const obj = new Asm(inc, { debug: true }).run(src, `/usr/share/thistle/examples/${name}.tas`).obj;
    f(`/usr/share/thistle/examples/${name}.to`, codec.pack(obj));
    const exe = new Link().run([obj], { names: [`${name}.to`] }).exe;
    const bin = codec.pack(exe);
    f(`/usr/bin/${name}.txe`, bin, 0o755);
    k.fs.symlink(`/usr/bin/${name}.txe`, `/bin/${name}.txe`, "/", r);
    if (name === "hello") {
      k.fs.symlink(`/usr/bin/${name}.txe`, `/usr/bin/${name}.thx`, "/", r);
      k.fs.symlink(`/usr/bin/${name}.txe`, `/usr/bin/${name}.39`, "/", r);
      k.fs.symlink(`/usr/bin/${name}.thx`, `/bin/${name}.thx`, "/", r);
      k.fs.symlink(`/usr/bin/${name}.39`, `/bin/${name}.39`, "/", r);
    }
  }
  const old = new Asm(inc, { debug: true, arch: "thistle32" }).run(HELLO32_TAS, "/usr/share/thistle/examples/hello32.tas").obj;
  f("/usr/share/thistle/examples/hello32.to", codec.pack(old));
  f("/usr/bin/hello32.txe", codec.pack(new Link().run([old], { names: ["hello32.to"] }).exe), 0o755);
  k.fs.symlink("/usr/bin/hello32.txe", "/bin/hello32.txe", "/", r);
  k.log("vfs: root image mounted read-write");
  k.log("wasm: WASI preview1 loader registered");
  k.log("native: thistle64 loader and Thistle 1 compatibility registered");
  k.log("net: HTTP transport registered");
  k.log(`userland: ${k.apps.size} executables installed`);
};

/** Rebuild the bits which are alive, rather than files wearing convincing hats. */
export const live = (k: Kern): void => {
  const reset = (name: string): Dir => {
    const old = k.fs.root.ent.get(name), d = old instanceof Dir ? old : new Dir();
    d.ent.clear(); d.mode = 0o755; d.uid = 0; d.gid = 0; k.fs.root.ent.set(name, d); return d;
  };
  reset("dev"); reset("proc");
  k.fs.mkdir("/proc/net", "/", r);
  const ro = (): never => bad("EROFS", "read-only device");
  const rnd = (n: number): Uint8Array => { const b = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(b.subarray(i, Math.min(i + 65536, n))); return b; };

  k.fs.char("/dev/null", () => new Uint8Array(), b => b.length, "/", r);
  k.fs.char("/dev/zero", n => new Uint8Array(n), b => b.length, "/", r, 0o666, true);
  k.fs.char("/dev/random", rnd, b => b.length, "/", r, 0o444, true);
  k.fs.char("/dev/urandom", rnd, b => b.length, "/", r, 0o444, true);
  k.fs.char("/dev/full", () => new Uint8Array(), () => bad("ENOSPC", "/dev/full"), "/", r);
  k.fs.char("/dev/console", () => new Uint8Array(), b => { k.tty(dec(b), false); return b.length; }, "/", r, 0o620);
  k.fs.symlink("/dev/console", "/dev/tty", "/", r);

  k.fs.char("/proc/version", () => enc(`${k.name} version ${k.release} (${k.executionCore}; thistle64; Thistle 1 compat; WebAssembly guest support)\n`), ro, "/", r, 0o444);
  k.fs.char("/proc/uptime", () => enc(`${((Date.now() - k.born) / 1000).toFixed(2)} 0.00\n`), ro, "/", r, 0o444);
  k.fs.char("/proc/loadavg", () => enc(`0.00 0.00 0.00 ${k.ps().filter(p => p.state === "run").length}/${k.ps().length} ${Math.max(...k.ps().map(p => p.pid))}\n`), ro, "/", r, 0o444);
  k.fs.char("/proc/meminfo", () => enc(`MemTotal:       ${Math.floor(k.lim.mem / 1024)} kB\nMemAvailable:   ${Math.floor(k.lim.mem / 1024)} kB\nVfsTotal:       ${Math.floor(k.fs.cap / 1024)} kB\nVfsUsed:        ${Math.floor(k.fs.used() / 1024)} kB\n`), ro, "/", r, 0o444);
  k.fs.char("/proc/mounts", () => enc(k.mounts().map(x => `${x.src} ${x.at} ${x.kind} ${x.opt} 0 0`).join("\n") + "\n"), ro, "/", r, 0o444);
  k.fs.char("/proc/net/dev", () => enc(`Inter-| Receive | Transmit\n host: ${k.net.rx} ${k.net.tx}\nrequests ${k.net.calls} failed ${k.net.fails}\n`), ro, "/", r, 0o444);
  refreshBuiltinRescues(k);
  k.log("devfs: null zero random console ready");
};
