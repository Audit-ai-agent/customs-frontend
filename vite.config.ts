import { defineConfig } from "vitest/config";

export default defineConfig(({ command, mode }) => {
  // There are exactly two local browser modes: no-secret team development and
  // the explicit functional UAT topology.
  const runtimeMode = mode === "functional-uat" ? "functional-uat" : "local-development";
  const functionalUatConnectSource = runtimeMode === "functional-uat"
    ? " http://127.0.0.1:18088"
    : "";
  return {
    plugins: [
      {
        name: "customs-dev-style-csp",
        transformIndexHtml(html) {
          // Vite's development CSS module is injected as a <style> element.
          // Allow that one local development mechanism without weakening the
          // static build, whose generated CSS remains an external same-origin file.
          return html.replace(
            "__CUSTOMS_DEV_STYLE_SOURCE__",
            command === "serve" ? " 'unsafe-inline'" : "",
          ).replace("__CUSTOMS_CONNECT_SOURCE__", functionalUatConnectSource);
        },
      },
    ],
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
      exclude: ["node_modules/**", "dist/**", "e2e/**"],
    },
  };
});
