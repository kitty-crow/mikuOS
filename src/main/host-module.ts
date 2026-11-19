interface HostModules {
  "node:fs/promises": typeof import("node:fs/promises");
  "node:path": typeof import("node:path");
  "node:url": typeof import("node:url");
  "node:zlib": typeof import("node:zlib");
  "node:worker_threads": typeof import("node:worker_threads");
}

/** Load an explicitly supported host module without bundling it into the browser. */
export async function hostModule<Name extends keyof HostModules>(name: Name): Promise<HostModules[Name]> {
  // The platform loader resolves these whitelisted built-ins; dynamic import is typed any.
  //@cg-expect-warning
  return await import(name) as HostModules[Name];
}
