import { defineConfig } from "vitest/config";

export default defineConfig(({ command, mode }) => {
  // There are exactly two local browser modes: no-secret team development and
  // the explicit functional UAT topology.
  const runtimeMode = mode === "functional-uat" ? "functional-uat" : "local-development";
  return {
    plugins: [
      {
        name: "customs-dev-style-csp",
        transformIndexHtml(html) {
          // Vite's development CSS module is injected as a <style> element.
          // Allow that one local development mechanism without weakening the
          // static build, whose generated CSS remains an external same-origin file.
          return html
            .replace(
              "__CUSTOMS_DEV_STYLE_SOURCE__",
              command === "serve" ? " 'unsafe-inline'" : "",
            )
            .replace(
              // Functional UAT authenticates against the local Keycloak origin
              // directly from the browser (OIDC code + PKCE token exchange), so
              // that one origin joins connect-src. Team development keeps the
              // strict same-origin policy: its dev session is a Backend API call.
              "__CUSTOMS_AUTH_CONNECT_SOURCE__",
              runtimeMode === "functional-uat" ? " http://127.0.0.1:18088" : "",
            );
        },
      },
    ],
    // JSX is transformed by Vite's built-in Oxc pipeline using the `jsx: "react-jsx"`
    // setting in tsconfig.json, which keeps @vitejs/plugin-react out of the dependency
    // tree. The cost is a full reload instead of Fast Refresh, which the boundary check
    // in scripts/check-static-boundaries.mjs deliberately trades away.
    define: {
      __CUSTOMS_RUNTIME_MODE__: JSON.stringify(runtimeMode),
    },
    base: "/",
    build: {
      outDir: "dist",
      manifest: true,
      sourcemap: false,
      target: "es2022",
    },
    server: {
      proxy: {
        "/api/v1": {
          target: process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:18081",
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: "jsdom",
      exclude: ["node_modules/**", "dist/**"],
    },
  };
});
