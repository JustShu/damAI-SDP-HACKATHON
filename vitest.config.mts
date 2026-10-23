import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    include: ["tests/**/*.test.ts"],
    // Tests never call a real AI service, even if .env has keys (Prisma loads .env).
    env: { DATABASE_URL: "file:./test.db", SESSION_SECRET: "test-secret-test-secret-test-secret-123", MEDIATOR_PROVIDER: "local", GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "" },
    fileParallelism: false, // tests share one SQLite file
    testTimeout: 20000,
  },
});
