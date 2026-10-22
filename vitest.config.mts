import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: "file:./test.db", SESSION_SECRET: "test-secret-test-secret-test-secret-123" },
    fileParallelism: false, // tests share one SQLite file
    testTimeout: 20000,
  },
});
