import worker from "../dist/server/index.js";

const env = {};
const page = await worker.fetch(new Request("https://nanal.test/"), env);
if (page.status !== 200) throw new Error(`Homepage returned ${page.status}`);
const html = await page.text();
const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\\.(?:js|css))"/g)].map((match) => match[1]);
if (!assetPaths.some((asset) => asset.endsWith(".js")) || !assetPaths.some((asset) => asset.endsWith(".css"))) {
  throw new Error("Homepage does not reference both a JavaScript and CSS bundle");
}
for (const assetPath of assetPaths) {
  const asset = await worker.fetch(new Request(new URL(assetPath, "https://nanal.test/")), env);
  const body = await asset.text();
  if (asset.status !== 200 || body.length === 0) throw new Error(`Asset did not load: ${assetPath} (${asset.status})`);
  if (assetPath.endsWith(".js") && !body.includes("4주")) throw new Error("JavaScript asset lacks the current four-week goal UI");
}
const status = await worker.fetch(new Request("https://nanal.test/api/narrative-status"), env);
if (status.status !== 200 || (await status.json()).available !== false) {
  throw new Error("Narrative status route did not return its keyless availability state");
}
console.log(`Verified homepage, ${assetPaths.length} hashed assets, and narrative status route`);