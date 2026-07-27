import { readFile } from "node:fs/promises";

const expectedNode = "22.23.1";
const expectedNpm = "10.9.8";
const problems = [];
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

if (process.versions.node !== expectedNode) {
  problems.push(`Node ${expectedNode} is required; found ${process.versions.node}`);
}
const npmUserAgent = process.env.npm_config_user_agent ?? "";
const npmMatch = /^npm\/([^\s]+)/.exec(npmUserAgent);
if (npmMatch?.[1] !== expectedNpm) {
  problems.push(`npm ${expectedNpm} is required; found ${npmMatch?.[1] ?? "unknown"}`);
}
if (packageJson.engines?.node !== expectedNode) problems.push("package.json engines.node does not match the runtime pin");
if (packageJson.packageManager !== `npm@${expectedNpm}`) problems.push("package.json packageManager does not match the npm pin");
if (packageLock.lockfileVersion !== 3) problems.push("package-lock.json must use lockfileVersion 3");
if (packageLock.packages?.[""]?.engines?.node !== expectedNode) problems.push("package-lock.json does not preserve the exact Node pin");
const expectedPackages = {
  react: "19.2.8",
  "react-dom": "19.2.8",
  "react-router": "8.3.0",
  "@vitejs/plugin-react": "6.0.4",
  vite: "8.1.5",
  "@testing-library/react": "16.3.2",
  "@testing-library/user-event": "14.6.1",
  "@playwright/test": "1.62.0",
};
for (const [name, version] of Object.entries(expectedPackages)) {
  const declared = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  if (declared !== version) problems.push(`${name} must be declared at exact version ${version}`);
  if (packageLock.packages?.[`node_modules/${name}`]?.version !== version) {
    problems.push(`package-lock.json must resolve ${name} to exact version ${version}`);
  }
}
if (packageJson.dependencies?.["react-router-dom"] !== undefined) {
  problems.push("react-router-dom is prohibited by the High-severity dependency gate; see DL-0008");
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Doctor passed (Node ${expectedNode}, npm ${expectedNpm}, lockfile v3).`);
