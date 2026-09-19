#!/usr/bin/env node
/**
 * Normalize wrangler dry-run output into a single release asset: dist/worker.mjs
 * (module format, no source map reference).
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const srcCandidates = ["index.js", "index.mjs", "worker.js", "worker.mjs"];
const src = srcCandidates.map((n) => join(dist, n)).find((p) => existsSync(p));
if (!src) {
  console.error("No wrangler bundle found in dist/ (expected index.js). Run wrangler deploy --dry-run --outdir=dist first.");
  process.exit(1);
}
let code = readFileSync(src, "utf8");
code = code.replace(/\n\/\/# sourceMappingURL=.*$/m, "\n");
const out = join(dist, "worker.mjs");
writeFileSync(out, code);
// Drop map from the release tree if present
const map = join(dist, "index.js.map");
if (existsSync(map)) {
  try {
    unlinkSync(map);
  } catch {
    /* ignore */
  }
}
console.log(`Wrote ${out} (${Buffer.byteLength(code)} bytes)`);
