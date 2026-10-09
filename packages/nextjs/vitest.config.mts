import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for Mabrur's own frontend code. Scaffold-ETH 2 library code is out of scope.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "~~": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      include: [
        "utils/mabrur/**",
        "hooks/mabrur/**",
        "components/mabrur/**",
        "components/Header.tsx",
        "components/Footer.tsx",
        "app/page.tsx",
        "app/app/**",
        "app/judge/**",
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100, perFile: true },
    },
  },
});
