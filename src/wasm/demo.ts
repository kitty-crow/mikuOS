const leb = (n: number): number[] => {
  const b: number[] = [];
  do {
    let x = n & 0x7f;
    n >>>= 7;
    if (n) x |= 0x80;
    b.push(x);
  } while (n);
  return b;
};

const txt = (s: string): number[] => {
  const b = [...new TextEncoder().encode(s)];
  return [...leb(b.length), ...b];
};

const sec = (id: number, b: number[]): number[] => [id, ...leb(b.length), ...b];

/** A tiny, standards-shaped WASI binary. Keeping the builder here is nicer
 * than hiding an unexplained base64 brick in the boot image. */
export const demoWasm = (): Uint8Array => {
  const line = "Hello from a real WASI binary inside Thistle!\n";
  const dat = [...new TextEncoder().encode(line)];
  const type = sec(1, [
    2,
    0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f,
    0x60, 0, 0,
  ]);
  const imp = sec(2, [1, ...txt("wasi_snapshot_preview1"), ...txt("fd_write"), 0, 0]);
  const fun = sec(3, [1, 1]);
  const mem = sec(5, [1, 0, 1]);
  const exp = sec(7, [
    2,
    ...txt("memory"), 2, 0,
    ...txt("_start"), 0, 1,
  ]);
  const ins = [
    0,
    0x41, 0, 0x41, 16, 0x36, 2, 0,
    0x41, 4, 0x41, ...leb(dat.length), 0x36, 2, 0,
    0x41, 1, 0x41, 0, 0x41, 1, 0x41, 8, 0x10, 0, 0x1a,
    0x0b,
  ];
  const code = sec(10, [1, ...leb(ins.length), ...ins]);
  const data = sec(11, [1, 0, 0x41, 16, 0x0b, ...leb(dat.length), ...dat]);
  return new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, ...type, ...imp, ...fun, ...mem, ...exp, ...code, ...data]);
};
