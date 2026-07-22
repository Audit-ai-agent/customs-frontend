import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LOCAL USER UAT frontend container", () => {
  it("is explicitly diagnostic and uses exact Node/npm runtime boundaries", async () => {
    const dockerfile = await readFile(resolve("deploy/uat/Dockerfile"), "utf8");
    const entrypoint = await readFile(resolve("deploy/uat/entrypoint.sh"), "utf8");

    expect(dockerfile).toContain("node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e");
    expect(dockerfile).toContain('com.customs.production="false"');
    expect(dockerfile).toContain('com.customs.auto-completion="off"');
    expect(dockerfile).not.toContain("18088");
    expect(entrypoint).toContain('process.version !== "v22.23.1"');
    expect(entrypoint).toContain('npm --version)" != "10.9.8"');
    expect(entrypoint).toContain("--host 0.0.0.0 --port 5173 --strictPort");
  });

  it("requires only Backend-owned same-origin proxy targets", async () => {
    const vite = await readFile(resolve("vite.config.ts"), "utf8");
    const entrypoint = await readFile(resolve("deploy/uat/entrypoint.sh"), "utf8");
    const readme = await readFile(resolve("deploy/uat/README.md"), "utf8");

    expect(vite).toContain('process.env.BACKEND_ORIGIN');
    expect(vite).toContain('process.env.OIDC_BACKEND_ORIGIN');
    expect(entrypoint).toContain("BACKEND_ORIGIN is required");
    expect(entrypoint).toContain("OIDC_BACKEND_ORIGIN is required");
    expect(readme).toContain('127.0.0.1:18088:5173');
    expect(vite).not.toMatch(/\/internal\/agent|\/evidence/);
  });
});
