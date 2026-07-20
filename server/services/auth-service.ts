import "server-only";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import type { User } from "@/lib/generated/prisma/client";
import { CourseRole, UserRole, WhitelistStatus } from "@/lib/generated/prisma/enums";

// Döküman 8.1: Kayıt işlemi tek transaction içinde yapılır.
// Ek karar (kullanıcı onaylı): STUDENT rolündeki yeni kullanıcı aktif derslere
// otomatik olarak üye yapılır.
export async function registerUser(params: {
  email: string; // normalize edilmiş olmalı
  name: string;
  password: string;
}): Promise<User> {
  const passwordHash = await hashPassword(params.password);

  return prisma.$transaction(async (tx) => {
    // 1-2. White-list kaydını bul ve PENDING olduğunu doğrula (FR-1.2, FR-1.5)
    const entry = await tx.whitelistEntry.findUnique({ where: { email: params.email } });
    if (!entry) {
      throw new ApiError(
        "FORBIDDEN",
        "Bu e-posta adresi kayıt için yetkilendirilmemiş. Öğretmeninizle iletişime geçin.",
      );
    }
    if (entry.status === WhitelistStatus.REGISTERED) {
      throw new ApiError("CONFLICT", "Bu davet daha önce kullanılmış. Giriş yapmayı deneyin.");
    }
    if (entry.status === WhitelistStatus.REVOKED) {
      throw new ApiError("FORBIDDEN", "Bu e-posta adresinin kayıt izni iptal edilmiş.");
    }

    // 3. Aynı e-posta ile kullanıcı olmadığını doğrula (FR-1.4)
    const existingUser = await tx.user.findUnique({ where: { email: params.email } });
    if (existingUser) {
      throw new ApiError("CONFLICT", "Bu e-posta adresiyle bir hesap zaten var.");
    }

    // 4-5. Kullanıcıyı oluştur (şifre hash'i transaction dışında hesaplandı)
    const user = await tx.user.create({
      data: {
        email: params.email,
        name: params.name,
        passwordHash,
        role: entry.role,
      },
    });

    // 6-8. White-list kaydını kullanıcıya bağla, REGISTERED yap, tarihi kaydet
    await tx.whitelistEntry.update({
      where: { id: entry.id },
      data: {
        userId: user.id,
        status: WhitelistStatus.REGISTERED,
        registeredAt: new Date(),
      },
    });

    // Ek: öğrenciyi aktif derslere otomatik üye yap
    if (entry.role === UserRole.STUDENT) {
      const activeCourses = await tx.course.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      if (activeCourses.length > 0) {
        await tx.courseMembership.createMany({
          data: activeCourses.map((course) => ({
            courseId: course.id,
            userId: user.id,
            role: CourseRole.STUDENT,
          })),
          skipDuplicates: true,
        });
      }
    }

    return user;
  });
}

export function serializeUser(user: Pick<User, "id" | "email" | "name" | "role">) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
