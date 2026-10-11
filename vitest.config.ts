import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/service/src/**/*.test.ts"],
    environment: "node",
  },
});
