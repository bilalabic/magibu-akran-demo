import "server-only";

import { createHash } from "node:crypto";

import { durationToSeconds, refreshTokenTtl } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import type { Session } from "@/lib/generated/prisma/client";

// FR-1.9: Refresh token'ın düz değeri değil, SHA-256 hash'i saklanır.
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate(): Date {
  return new Date(Date.now() + durationToSeconds(refreshTokenTtl()) * 1000);
}

export async function createSession(params: {
  userId: string;
  refreshToken: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<Session> {
  return prisma.session.create({
    data: {
      userId: params.userId,
      refreshTokenHash: hashRefreshToken(params.refreshToken),
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
      expiresAt: refreshExpiryDate(),
    },
  });
}

export async function findActiveSessionByToken(refreshToken: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashRefreshToken(refreshToken) },
  });
  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  return session;
}

// Refresh rotation: aynı oturum kaydı yeni token hash'iyle güncellenir.
export async function rotateSession(sessionId: string, newRefreshToken: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash: hashRefreshToken(newRefreshToken),
      expiresAt: refreshExpiryDate(),
      lastUsedAt: new Date(),
    },
  });
}

// NFR-1.10: Çıkışta ilgili oturum iptal edilir.
export async function revokeSessionByToken(refreshToken: string): Promise<void> {
  await prisma.session.updateMany({
    where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Şifre sıfırlama sonrası tüm oturumları düşürmek için (NFR-1.9).
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
