import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

// NFR-2.5: dev ortamında hot-reload sırasında client tekrar tekrar oluşturulmaz.
// Bu modül yalnızca sunucu tarafında import edilmelidir (route handler, server
// component, script). Client bundle'a girmesi durumunda node:* importları zaten
// build hatası verir; ayrıca servis katmanı dosyaları "server-only" kullanır.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil. .env dosyasını doldurun.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
