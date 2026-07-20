import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../lib/db/prisma";
import { UserRole, WhitelistStatus } from "../lib/generated/prisma/enums";

// Öğretmen hesabı oluşturma CLI'ı.
// Kullanım: npx tsx scripts/create-teacher.ts --email a@b.c --password "..." [--name "Ad Soyad"]
// Argüman verilmezse INITIAL_TEACHER_* env değerlerine düşer.

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const email = (readArg("--email") ?? process.env.INITIAL_TEACHER_EMAIL ?? "")
    .trim()
    .toLowerCase();
  const password = readArg("--password") ?? process.env.INITIAL_TEACHER_PASSWORD ?? "";
  const name = (readArg("--name") ?? process.env.INITIAL_TEACHER_NAME ?? "Öğretmen").trim();

  if (!email || !email.includes("@")) {
    throw new Error("Geçerli bir e-posta gerekli (--email veya INITIAL_TEACHER_EMAIL).");
  }
  if (password.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalı (--password veya INITIAL_TEACHER_PASSWORD).");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Bu e-posta ile kullanıcı zaten var: ${email} (rol: ${existing.role})`);
    return;
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(password, rounds);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, passwordHash, role: UserRole.TEACHER },
    });
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
    console.error("Hata:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
