export type Path = string | URL;

export interface Ent {
  name: string;
  isDirectory(): boolean;
}

export interface FsP {
  access(p: Path): Promise<void>;
  mkdir(p: Path, o: { recursive: boolean }): Promise<unknown>;
  writeFile(p: Path, b: Uint8Array | string): Promise<void>;
  readFile(p: Path, encoding: "utf8"): Promise<string>;
  copyFile(a: Path, b: Path): Promise<void>;
  readdir(p: Path, o: { withFileTypes: true }): Promise<Ent[]>;
  rm(p: Path, o: { recursive: boolean; force: boolean }): Promise<void>;
}

const mod = (name: string): Promise<unknown> => import(name);
const fs = await mod("node:fs/promises") as FsP;

export const fsp = (): FsP => fs;
