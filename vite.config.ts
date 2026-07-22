import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
  },
  server: {
    proxy: {
      "/api/v1": {
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
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
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
