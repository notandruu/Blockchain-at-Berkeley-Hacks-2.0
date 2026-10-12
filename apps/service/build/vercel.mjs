// Bundles the service into one ESM file and writes Vercel's Build Output API layout, so
// the deploy runs exactly the code esbuild resolved here (workspace packages included).
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const out = ".vercel/output";
const fn = `${out}/functions/index.func`;
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: ["src/vercel.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: `${fn}/index.mjs`,
  // ws probes for these native speedups and falls back without them.
  external: ["bufferutil", "utf-8-validate"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});

writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({
  runtime: "nodejs22.x",
  handler: "index.mjs",
  launcherType: "Nodejs",
  shouldAddHelpers: false,
  supportsResponseStreaming: true,
  maxDuration: 300,
}, null, 2));
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: "module" }));
writeFileSync(`${out}/config.json`, JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }, null, 2));
console.log("built", fn);
