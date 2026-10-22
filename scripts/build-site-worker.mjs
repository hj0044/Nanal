import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const assets = {};

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else {
      const relativePath = `/${path.relative(dist, file).split(path.sep).join("/")}`;
      assets[relativePath] = await readFile(file, "utf8");
    }
  }
}

await collect(dist);
await writeFile(path.join(dist, "site-assets.generated.js"), `export default ${JSON.stringify(assets)};\n`);
await mkdir(path.join(dist, "server"), { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ["scripts/site-worker-entry.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
});
console.log(`Bundled ${Object.keys(assets).length} frontend files into dist/server/index.js`);