import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const redoclyRoot = resolve(
  projectRoot,
  "node_modules",
  "openapi-typescript",
  "node_modules",
  "@redocly",
  "openapi-core",
);
const redoclyPackagePath = resolve(redoclyRoot, "package.json");
const runtimePath = resolve(redoclyRoot, "lib", "utils.js");
const requireFromRedocly = createRequire(runtimePath);
const minimatchPackagePath = requireFromRedocly.resolve("minimatch/package.json");

const redoclyPackage = JSON.parse(await readFile(redoclyPackagePath, "utf8"));
if (redoclyPackage.version !== "1.34.17") {
  throw new Error(`Refusing to patch unexpected @redocly/openapi-core ${redoclyPackage.version}`);
}

const minimatchPackage = JSON.parse(await readFile(minimatchPackagePath, "utf8"));
if (minimatchPackage.version !== "10.2.5") {
  throw new Error(`Refusing to patch unexpected minimatch ${minimatchPackage.version}`);
}

const original = 'const minimatch = require("minimatch");';
const patched = 'const { minimatch } = require("minimatch");';
const source = await readFile(runtimePath, "utf8");
const originalCount = source.split(original).length - 1;
const patchedCount = source.split(patched).length - 1;

if (patchedCount === 1 && originalCount === 0) {
  console.log("Redocly minimatch compatibility patch already applied.");
} else if (originalCount === 1 && patchedCount === 0) {
  await writeFile(runtimePath, source.replace(original, patched), "utf8");
  console.log("Applied the reviewed Redocly minimatch 10 compatibility patch.");
} else {
  throw new Error("Refusing to patch an unexpected Redocly minimatch import shape");
}
