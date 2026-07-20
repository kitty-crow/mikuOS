import { boot } from "../main/boot.js";
import { rootPkg } from "../main/pkg.js";
import { Exe, codec } from "../asm/fmt.js";

const ok: (v: unknown, m: string) => asserts v = (v, m) => { if (!v) throw new Error(m); };
let out = "", err = "";
const os = boot({ put: (s, ch) => { if (ch === "err") err += s; else out += s; }, pkg: rootPkg });

const run = async (s: string): Promise<{ code: number; out: string; err: string; ms: number }> => {
  out = ""; err = ""; const at = Date.now(), code = await os.run(s);
  return { code, out, err, ms: Date.now() - at };
};

const need = async (cmd: string, word: string): Promise<void> => {
  const q = await run(cmd);
  ok(q.code === 0, `${cmd} exited ${q.code}: ${q.err}`);
  ok((q.out + q.err).includes(word), `${cmd} did not identify ${word}`);
};

const build = async (cc: string, src: string, dst: string, text: string): Promise<void> => {
  const q = await run(`${cc} -O1 -o ${dst} ${src}`);
  ok(q.code === 0, `${cc} failed after ${q.ms} ms: ${q.err}`);
  const x = codec.unpack(os.s.readb(dst));
  ok(x instanceof Exe && x.machine === "thistle64" && x.isa === "rv64gc", `${cc} did not emit a Thistle64 RV64GC executable`);
  const z = await run(dst);
  ok(z.code === 0, `${dst} exited ${z.code}: ${z.err}`);
  ok(z.out === text, `${dst} printed ${JSON.stringify(z.out)}`);
  console.log(`ok - ${cc} compiled and ran ${src} in ${q.ms + z.ms} ms`);
};

await os.ready;
await need("tcc -v", "0.9.28rc");
await need("clang --version", "22.1.0");
await need("gcc --version", "16.1.0");
await need("cpp --version", "16.1.0");
await need("riscv64-unknown-linux-musl-gcc -dumpmachine", "riscv64-unknown-linux-musl");
await need("gas --version", "2.46.1");
await need("gld --version", "2.46.1");
await need("ld.lld --version", "22.1.0");

const c = "/usr/share/thistle/examples/hello.c", cc = "/usr/share/thistle/examples/hello.cc";
await build("tcc", c, "/tmp/tcc-hello.thx", "hello from C\n");
await build("clang", c, "/tmp/clang-hello.thx", "hello from C\n");
await build("gcc", c, "/tmp/gcc-hello.thx", "hello from C\n");
await build("clang++", cc, "/tmp/clangxx-hello.thx", "hello from C++\n");
await build("g++", cc, "/tmp/gxx-hello.thx", "hello from C++\n");

const miss = os.k.logs.filter(x => x.includes("rv64: unsupported syscall"));
ok(!miss.length, `compiler processes probed unimplemented syscalls:\n${miss.join("\n")}`);
