import { chmod, readFile, writeFile } from "node:fs/promises";
import { elf } from "../elf/elf.js";
import { codec } from "../asm/fmt.js";

const av = process.argv.slice(2);
const src = av[0] ?? null;
const dst = av[1] ?? null;
if (av.length !== 2 || src === null || dst === null) {
  throw new Error("usage: elf2thx-host input.elf output.{thx,39}");
}
const b = new Uint8Array(await readFile(src));
const name = src.split(/[\\/]/).at(-1) ?? src;
await writeFile(dst, codec.pack(elf.run(b, name)));
await chmod(dst, 0o755);
