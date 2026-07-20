import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

// NFR-2.5: dev ortamında hot-reload sırasında client tekrar tekrar oluşturulmaz.
// Bu modül yalnızca sunucu tarafında import edilmelidir (route handler, server
// component, script). Client bundle'a girmesi durumunda node:* importları zaten
// build hatası verir; ayrıca servis katmanı dosyaları "server-only" kullanır.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createPrismaClient(): PrismaClient {
  // next build dinamik route'leri analiz ederken gerçek production secret'ına
  // ihtiyaç duymaz. Böylece Docker build aşamasına veritabanı şifresi verilmez.
  const connectionString =
    process.env.DATABASE_URL ??
    (process.env.NEXT_PHASE === "phase-production-build"
      ? "postgresql://build:build@127.0.0.1:5432/build"
      : undefined);
  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil. .env dosyasını doldurun.");
  }
  const adapter = new PrismaPg({
    connectionString,
    max: positiveInt(process.env.DB_POOL_MAX, 5),
    connectionTimeoutMillis: positiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 5_000),
    idleTimeoutMillis: positiveInt(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
    application_name: process.env.COOLIFY_APP_NAME ?? "magibudemo-web",
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
