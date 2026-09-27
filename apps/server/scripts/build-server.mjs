import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [resolve(packageRoot, "src/index.ts")],
  outfile: resolve(packageRoot, "dist/server.mjs"),
  platform: "node",
  format: "esm",
  target: "node20",
  bundle: true,
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});
