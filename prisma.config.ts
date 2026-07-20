import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migration/introspection komutları session bağlantısı ister (DIRECT_URL).
// Runtime client, lib/db/prisma.ts içinde DATABASE_URL (transaction pooler) kullanır.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
