import { SignJWT, jwtVerify } from "jose";

import type { UserRole } from "@/lib/generated/prisma/enums";

// FR-1.7: Kısa süreli access + uzun süreli refresh token.
// Bu modül Edge (proxy.ts) ve Node ortamlarının ikisinde de çalışır; bu yüzden
// node:crypto yerine jose kullanılır ve Prisma'ya bağımlılığı yoktur.

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  role: UserRole;
  type: "refresh";
  jti: string;
};

const encoder = new TextEncoder();

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} tanımlı değil veya çok kısa (en az 32 karakter).`);
  }
  return encoder.encode(value);
}

export function accessTokenTtl(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
}

export function refreshTokenTtl(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
}

// "15m" / "7d" / "12h" / "900s" biçimini saniyeye çevirir (cookie maxAge için).
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    const asNumber = Number(duration);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber);
    throw new Error(`Geçersiz süre biçimi: ${duration}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return value * multiplier;
}

export async function signAccessToken(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(accessTokenTtl())
    .sign(secret("JWT_ACCESS_SECRET"));
}

export async function signRefreshToken(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ role, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(refreshTokenTtl())
    .sign(secret("JWT_REFRESH_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"));
    if (payload.type !== "access" || typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      type: "access",
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret("JWT_REFRESH_SECRET"));
    if (
      payload.type !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      type: "refresh",
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
