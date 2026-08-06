import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // There are exactly two local browser modes: no-secret team development and
  // the explicit functional UAT topology.
  const runtimeMode = mode === "functional-uat" ? "functional-uat" : "local-development";
  return {
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
