import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../lib/db/prisma";
import { UserRole, WhitelistStatus } from "../lib/generated/prisma/enums";

// İlk öğretmen hesabını INITIAL_TEACHER_* env değerlerinden oluşturur.
// Idempotent: kullanıcı zaten varsa dokunmaz.
async function main() {
  const email = process.env.INITIAL_TEACHER_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_TEACHER_PASSWORD;
  const name = process.env.INITIAL_TEACHER_NAME?.trim() || "Öğretmen";

  if (!email || !password) {
    throw new Error(
      "INITIAL_TEACHER_EMAIL ve INITIAL_TEACHER_PASSWORD env değerleri gerekli.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Öğretmen zaten mevcut: ${email} (id: ${existing.id})`);
    return;
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(password, rounds);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: UserRole.TEACHER,
      },
    });

    // Öğretmen için de whitelist kaydı tutulur (REGISTERED) — böylece
    // "her kullanıcının whitelist kaydı" varsayımı raporlarda bozulmaz.
    await tx.whitelistEntry.upsert({
      where: { email },
      update: {
        status: WhitelistStatus.REGISTERED,
        role: UserRole.TEACHER,
        userId: user.id,
        registeredAt: new Date(),
      },
      create: {
        email,
        name,
        role: UserRole.TEACHER,
        status: WhitelistStatus.REGISTERED,
        userId: user.id,
        registeredAt: new Date(),
      },
    });

    return user;
  });

  console.log(`Öğretmen oluşturuldu: ${teacher.email} (id: ${teacher.id})`);
}

main()
  .catch((error) => {
    console.error("Seed hatası:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
