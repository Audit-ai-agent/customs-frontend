import { readFile } from "node:fs/promises";

const supportedNodeRange = ">=22.12.0 <23";
const minimumNode = [22, 12, 0];
const expectedNpm = "10.9.8";
const problems = [];
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

const nodeVersion = process.versions.node.split(".").map(Number);
const supportsNode = nodeVersion.length === 3
  && nodeVersion[0] === minimumNode[0]
  && (nodeVersion[1] > minimumNode[1]
    || (nodeVersion[1] === minimumNode[1] && nodeVersion[2] >= minimumNode[2]));
if (!supportsNode) {
  problems.push(`Node ${supportedNodeRange} is required; found ${process.versions.node}`);
}
const npmUserAgent = process.env.npm_config_user_agent ?? "";
const npmMatch = /^npm\/([^\s]+)/.exec(npmUserAgent);
if (npmMatch?.[1] !== expectedNpm) {
  problems.push(`npm ${expectedNpm} is required; found ${npmMatch?.[1] ?? "unknown"}`);
}
if (!process.env.COREPACK_ROOT) {
  problems.push("Corepack must select the pinned npm version; run through corepack npm");
}
if (packageJson.engines?.node !== supportedNodeRange) problems.push("package.json engines.node does not match the supported range");
if (packageJson.packageManager !== `npm@${expectedNpm}`) problems.push("package.json packageManager does not match the npm pin");
if (packageLock.lockfileVersion !== 3) problems.push("package-lock.json must use lockfileVersion 3");
if (packageLock.packages?.[""]?.engines?.node !== supportedNodeRange) problems.push("package-lock.json does not preserve the supported Node range");

for (const retired of [
  "react",
  "react-dom",
  "react-router",
  "react-router-dom",
  "@vitejs/plugin-react",
  "@testing-library/react",
  "@testing-library/user-event",
  "@vitest/coverage-v8",
  "axe-core",
  "@noble/hashes",
]) {
  if (packageJson.dependencies?.[retired] || packageJson.devDependencies?.[retired]) {
    problems.push(`retired dependency remains: ${retired}`);
  }
}
if (packageJson.devDependencies?.["@playwright/test"] !== "1.62.1") {
  problems.push("@playwright/test 1.62.1 is required for the local Functional-UAT Browser runner");
}
if (packageLock.packages?.["node_modules/@playwright/test"]?.version !== "1.62.1") {
  problems.push("package-lock.json must preserve @playwright/test 1.62.1 exactly");
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Doctor passed (Node ${supportedNodeRange}, npm ${expectedNpm}, lightweight dependency set).`);
