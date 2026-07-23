import { SharedTree } from "./sharedtree.js";
import type { SharedTreeOptions } from "./sharedtree.js";

export class AuthoritativeTree extends SharedTree {
  readonly authoritative = true;
  constructor(endpoint: string | URL, options: SharedTreeOptions = {}) {
    super(endpoint, options);
  }
}
