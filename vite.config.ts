import { defineConfig } from "vitest/config";

export default defineConfig(({ command, mode }) => {
  // There are exactly two local browser modes: no-secret team development and
  // the explicit functional UAT topology.
  const runtimeMode = mode === "functional-uat" ? "functional-uat" : "local-development";
  const publicTunnelHost = process.env.CUSTOMS_PUBLIC_TUNNEL_HOST ?? "";
  const keycloakTunnelProxy = {
    target: "http://127.0.0.1:18088",
    changeOrigin: false,
    headers: { "X-Forwarded-Proto": "https" },
  };
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
      // Optional public-tunnel exposure for a functional UAT, off unless
      // CUSTOMS_PUBLIC_TUNNEL_HOST is set. The tunnel host is allowed through
      // Vite's Host check and Keycloak is proxied onto the same origin so one
      // tunnel carries both the app and the login round trip. It pairs with the
      // Backend's CUSTOMS_BACKEND_PUBLIC_OIDC_ORIGIN.
      ...(publicTunnelHost ? { allowedHosts: [publicTunnelHost] } : {}),
      proxy: {
        "/api/v1": {
          target: process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:18081",
          changeOrigin: false,
        },
        ...(publicTunnelHost
          ? {
              "/realms": keycloakTunnelProxy,
              "/resources": keycloakTunnelProxy,
            }
          : {}),
      },
    },
    test: {
      environment: "jsdom",
      exclude: ["node_modules/**", "dist/**"],
    },
  };
});
