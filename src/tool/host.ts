import { mkdir as mkdirPath } from "node:fs";
import { copyFile, readFile, readdir, rm, writeFile } from "node:fs/promises";

export type Path = string | URL;

export interface Ent {
  name: string;
  isDirectory(): boolean;
}

export interface FsP {
  mkdir(p: Path, o: { recursive: boolean }): Promise<void>;
  writeFile(p: Path, b: Uint8Array): Promise<void>;
  readFile(p: Path, encoding: "utf8"): Promise<string>;
  copyFile(a: Path, b: Path): Promise<void>;
  readdir(p: Path, o: { withFileTypes: true }): Promise<Ent[]>;
  rm(p: Path, o: { recursive: boolean; force: boolean }): Promise<void>;
}

// The build tools only need directory creation to complete, not the first
// directory created by Node's recursive mkdir overload.
function mkdir(p: Path, o: { recursive: boolean }): Promise<void> {
  return new Promise<void>((done, fail) => {
    mkdirPath(p, o, error => {
      if (error) { fail(error); return; }
      done();
    });
  });
}

const fs: FsP = { mkdir, writeFile, readFile, copyFile, readdir, rm };

export const fsp = (): FsP => fs;
