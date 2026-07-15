import { DEFAULT_CONFIG } from "./config.js";

export const sourceReleaseName = (): string =>
  `mikuos-0.3.0-thistle-${DEFAULT_CONFIG.kernel.version}-source.tar.gz`;
