export type Errno =
  | "EACCES" | "EAGAIN" | "EBADF" | "EBUSY" | "ECHILD" | "EEXIST"
  | "EFAULT" | "EFBIG" | "EINTR" | "EINVAL" | "EIO" | "EISDIR" | "ELOOP" | "EMFILE"
  | "ENAMETOOLONG" | "ENFILE" | "ENOENT" | "ENOEXEC" | "ENOMEM"
  | "ENETUNREACH" | "ENOSPC" | "ENOSYS" | "ENOTDIR" | "ENOTEMPTY" | "ENOTSUP"
  | "EPERM" | "EPIPE" | "EPROTO" | "ERANGE" | "EROFS" | "ESRCH" | "ETIMEDOUT";

export class KErr extends Error {
  constructor(public readonly code: Errno, msg: string = code) {
    super(msg);
    this.name = "KErr";
  }
}

export const bad = (code: Errno, msg?: string): never => {
  throw new KErr(code, msg);
};

export const msg = (e: unknown): string => {
  if (e instanceof KErr) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
};
