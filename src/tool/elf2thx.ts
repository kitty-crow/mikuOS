import { elf } from "../elf/elf.js";
import { codec } from "../asm/fmt.js";

interface Fs {
  readFile(p: string): Promise<Uint8Array>;
  writeFile(p: string, b: Uint8Array): Promise<void>;
  chmod(p: string, mode: number): Promise<void>;
}

interface Proc { argv: string[]; }

const mod = (name: string): Promise<unknown> => import(name);
const fs = await mod("node:fs/promises") as Fs;
const av = (globalThis as unknown as { process: Proc }).process.argv.slice(2);

if (av.length !== 2) throw new Error("usage: elf2thx-host input.elf output.{thx,39}");
const [src, dst] = av as [string, string];
const b = new Uint8Array(await fs.readFile(src));
const name = src.split(/[\\/]/).at(-1) ?? src;
await fs.writeFile(dst, codec.pack(elf.run(b, name)));
await fs.chmod(dst, 0o755);
