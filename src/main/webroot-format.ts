export interface WebRootBaseEntry {
  p: string;
  k: "d" | "f" | "l";
  id: number;
  mode: number;
  uid: number;
  gid: number;
  at: number;
  mt: number;
  ct: number;
}

export interface WebRootDirectoryEntry extends WebRootBaseEntry {
  k: "d";
}

export interface WebRootLinkEntry extends WebRootBaseEntry {
  k: "l";
  to: string;
}

export interface WebRootCoreRef {
  kind: "core";
  offset: number;
  length: number;
}

export interface WebRootBlobRef {
  kind: "blob";
  path: string;
}

export interface WebRootFileEntry extends WebRootBaseEntry {
  k: "f";
  size: number;
  sum: string;
  head: string;
  ref: WebRootCoreRef | WebRootBlobRef;
}

export type WebRootEntry =
  | WebRootDirectoryEntry
  | WebRootLinkEntry
  | WebRootFileEntry;

export interface WebRootManifest {
  format: 1;
  image: number;
  generated: string;
  core: {
    path: string;
    encoding: "gzip";
    packedSize: number;
    unpackedSize: number;
  };
  entries: WebRootEntry[];
}
