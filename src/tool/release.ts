import { fsp } from "./host.js";
import { sourceReleaseName } from "../core/release.js";

const fs = fsp();
const root = new URL("../../", import.meta.url);
const dist = new URL("dist/", root);

await fs.mkdir(dist, { recursive: true });
await fs.writeFile(
  new URL(sourceReleaseName() + ".manifest", dist),
  new TextEncoder().encode(`${sourceReleaseName()}\n`),
);
