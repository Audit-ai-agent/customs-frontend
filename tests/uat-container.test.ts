import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LOCAL USER UAT frontend container", () => {
  it("is explicitly diagnostic and serves built external assets under strict CSP", async () => {
    const dockerfile = await readFile(resolve("deploy/uat/Dockerfile"), "utf8");
    const entrypoint = await readFile(resolve("deploy/uat/entrypoint.sh"), "utf8");
    const nginx = await readFile(resolve("deploy/uat/default.conf.template"), "utf8");

    expect(dockerfile).toContain("node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e");
    expect(dockerfile).toContain("nginxinc/nginx-unprivileged:stable-alpine@sha256:44e36330f74d4f3a1d4e222acca9e23b401fb87811a7597024502bb759c4dd49");
    expect(dockerfile).toContain("RUN npm run build:uat");
    expect(dockerfile).toContain("COPY --chown=node:node scripts ./scripts");
    expect(dockerfile).toContain("COPY --from=build /workspace/dist /usr/share/nginx/html");
    expect(dockerfile).toContain('com.customs.production="false"');
    expect(dockerfile).toContain('com.customs.auto-completion="off"');
    expect(dockerfile).not.toContain("18088");
    expect(dockerfile).not.toContain("vite --host");
    expect(entrypoint).toContain("BUILT ASSETS / STRICT CSP");
    expect(nginx).toContain("listen 5173");
    expect(nginx).toContain("style-src 'self'");
    expect(nginx).not.toContain("'unsafe-inline'");
    expect(nginx).toContain("location /assets/");
    expect(nginx).toContain("try_files $uri @asset_not_found");
    expect(nginx).toContain('return 404 "asset not found\\n"');
  });

  it("requires only Backend-owned same-origin proxy targets", async () => {
    const entrypoint = await readFile(resolve("deploy/uat/entrypoint.sh"), "utf8");
    const nginx = await readFile(resolve("deploy/uat/default.conf.template"), "utf8");
    const readme = await readFile(resolve("deploy/uat/README.md"), "utf8");

    expect(entrypoint).toContain("BACKEND_ORIGIN is required");
    expect(entrypoint).toContain("OIDC_BACKEND_ORIGIN is required");
    expect(nginx).toContain("proxy_pass ${BACKEND_ORIGIN}");
    expect(nginx).toContain("proxy_pass ${OIDC_BACKEND_ORIGIN}");
    expect(nginx).toContain('add_header X-Customs-OIDC-Policy "keycloak-upstream" always');
    expect(nginx).toContain("proxy_set_header Host $http_host");
    expect(entrypoint).toContain("port must be between 1 and 65535");
    expect(entrypoint).toContain("must not contain line breaks");
    expect(entrypoint).toContain('BACKEND_ORIGIN) value="$BACKEND_ORIGIN"');
    expect(entrypoint).toContain('OIDC_BACKEND_ORIGIN) value="$OIDC_BACKEND_ORIGIN"');
    expect(entrypoint).not.toContain('printenv "$name"');
    expect(readme).toContain('127.0.0.1:18088:5173');
    expect(nginx).not.toMatch(/\/internal\/agent|\/evidence/);
  });
});
