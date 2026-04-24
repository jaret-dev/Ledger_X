import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globals: false,
    // Dummy values so env.ts's Zod validation passes during test boot.
    // Actual DB access is mocked in the tests themselves.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test?schema=public",
      NODE_ENV: "test",
    },
  },
});
