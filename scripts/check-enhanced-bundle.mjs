import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const commercialKey = "src/experience/bootstrap.tsx";
const legacyKey = "src/app.ts";
const entryKey = "index.html";

for (const key of [commercialKey, legacyKey, entryKey]) {
  if (!manifest[key]) throw new Error(`Vite manifest is missing ${key}`);
}

const staticClosure = new Set();
const visit = (key) => {
  if (staticClosure.has(key)) return;
  staticClosure.add(key);
  for (const imported of manifest[key]?.imports ?? []) visit(imported);
};
visit(commercialKey);

if (staticClosure.has(legacyKey) || [...staticClosure].some((key) => key === "src/styles.css")) {
  throw new Error("Commercial workbench statically includes the legacy developer workbench");
}

const commercialFiles = [...staticClosure]
  .map((key) => manifest[key]?.file)
  .filter((value) => typeof value === "string");
const forbiddenMarkers = [
  "CUSTOMS REVIEW",
  "class AgentWorkbench",
  "humanize(",
];
for (const file of commercialFiles) {
  const content = await readFile(resolve("dist", file), "utf8");
  for (const marker of forbiddenMarkers) {
    if (content.includes(marker)) {
      throw new Error(`Commercial static bundle contains legacy marker ${JSON.stringify(marker)} in ${file}`);
    }
  }
}

const html = await readFile("dist/index.html", "utf8");
for (const legacyAsset of [
  manifest[legacyKey].file,
  ...(manifest["src/styles.css"]?.file ? [manifest["src/styles.css"].file] : []),
]) {
  if (html.includes(legacyAsset)) {
    throw new Error(`Commercial shell eagerly loads legacy asset ${legacyAsset}`);
  }
}

console.log(
  `Commercial bundle isolation passed (${commercialFiles.length} statically loaded chunks; legacy remains lazy).`,
);
