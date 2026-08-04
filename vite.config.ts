import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  define: {
    __CUSTOMS_ENHANCED_AGENT_EXPERIENCE__: JSON.stringify(
      process.env.CUSTOMS_ENHANCED_AGENT_EXPERIENCE === "true",
    ),
    __CUSTOMS_UAT_ADAPTIVE_ACTIVE__: JSON.stringify(
      process.env.CUSTOMS_UAT_ADAPTIVE_ACTIVE === "true",
    ),
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
        target: process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8080",
        changeOrigin: false,
      },
      "/api/v2": {
        target: process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8080",
        changeOrigin: false,
      },
      "/oidc": {
        target: process.env.OIDC_BACKEND_ORIGIN ?? "http://127.0.0.1:8082",
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/api/v1/generated.ts", "src/api/v1/types.ts", "src/main.ts"],
      thresholds: {
        statements: 75,
        branches: 60,
        functions: 70,
        lines: 75,
      },
    },
  },
});
