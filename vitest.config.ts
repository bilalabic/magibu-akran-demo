import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // "server-only" paketi test ortamında hata fırlatır; boş stub ile değiştirilir.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      JWT_ACCESS_SECRET: "test-access-secret-test-access-secret-1234567890",
      JWT_REFRESH_SECRET: "test-refresh-secret-test-refresh-secret-1234567890",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
      BCRYPT_ROUNDS: "10",
    },
  },
});
