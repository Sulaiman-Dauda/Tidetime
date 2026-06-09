import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // The app's tsconfig uses jsx:"preserve" for Next; tell the test bundler to
  // actually transform JSX so React Email templates (.tsx) render in tests.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "server-only": resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
