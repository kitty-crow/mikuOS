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

export const bad = (code: Errno, msg: string = code): never => {
  throw new KErr(code, msg);
};

export const msg = <T>(e: T): string => {
  if (e instanceof KErr) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
};

/** Convert a checked lookup to its value or raise an invalid-memory error. */
export function requireValue<T>(value: T | null, context: string): T {
  if (value === null) return bad("EFAULT", `${context}: missing value`);
  return value;
}

/** Apply an operation only when its input is present. */
export function withValue<T, R>(value: T | null, use: (value: T) => R): R | null {
  if (value === null) return null;
  return use(value);
}

/** Enforce an invariant while preserving control-flow narrowing and lazy errors. */
export function ensure<T>(condition: T, failure: () => never): asserts condition {
  if (!condition) failure();
}
