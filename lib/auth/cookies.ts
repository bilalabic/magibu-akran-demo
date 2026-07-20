import "server-only";

import { cookies } from "next/headers";

import { accessTokenTtl, durationToSeconds, refreshTokenTtl } from "@/lib/auth/jwt";

// FR-1.8: Token'lar HttpOnly ve (production'da) Secure cookie'lerde saklanır.
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

// Refresh cookie yalnızca auth endpoint'lerine gönderilir — saldırı yüzeyini daraltır.
const REFRESH_COOKIE_PATH = "/api/auth";

function baseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    ...baseOptions(),
    path: "/",
    maxAge: durationToSeconds(accessTokenTtl()),
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: durationToSeconds(refreshTokenTtl()),
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...baseOptions(), path: "/", maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...baseOptions(), path: REFRESH_COOKIE_PATH, maxAge: 0 });
}

export async function readAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
