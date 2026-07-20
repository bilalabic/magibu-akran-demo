import "server-only";

import { readAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import type { User } from "@/lib/generated/prisma/client";
import { UserRole, UserStatus } from "@/lib/generated/prisma/enums";

// NFR-1.4: Yetkilendirme her API endpoint'inde kontrol edilir; proxy.ts yalnızca
// sayfa yönlendirmesi yapar, güvenlik sınırı burasıdır.

export type AuthUser = Pick<User, "id" | "email" | "name" | "role" | "status">;

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
} as const;

// Cookie'deki access token'ı doğrulayıp aktif kullanıcıyı döndürür; yoksa null.
export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await readAccessToken();
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: AUTH_USER_SELECT,
  });
  if (!user || user.status !== UserStatus.ACTIVE) return null;
  return user;
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Bu işlem için giriş yapmalısınız.");
  }
  return user;
}

export async function requireRole(role: UserRole): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== role) {
    throw new ApiError("FORBIDDEN", "Bu işlem için yetkiniz yok.");
  }
  return user;
}

export async function requireTeacher(): Promise<AuthUser> {
  return requireRole(UserRole.TEACHER);
}

export async function requireStudent(): Promise<AuthUser> {
  return requireRole(UserRole.STUDENT);
}
