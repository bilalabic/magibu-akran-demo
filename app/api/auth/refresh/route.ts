import { NextResponse } from "next/server";

import { clearAuthCookies, readRefreshToken, setAuthCookies } from "@/lib/auth/cookies";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { clientIpFromRequest, enforceRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import {
  findActiveSessionByToken,
  revokeAllUserSessions,
  rotateSession,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { UserStatus } from "@/lib/generated/prisma/enums";
import { safeInternalPath } from "@/lib/utils/safe-redirect";
import { serializeUser } from "@/server/services/auth-service";

// Refresh rotation: geçerli refresh token yeni access+refresh çifti ile değiştirilir.
// JWT imzası geçerli ama oturum kaydı yoksa token yeniden kullanım (reuse)
// şüphesi vardır → kullanıcının tüm oturumları iptal edilir.
async function rotate() {
  const token = await readRefreshToken();
  if (!token) {
    throw new ApiError("UNAUTHORIZED", "Oturum bulunamadı.");
  }

  const payload = await verifyRefreshToken(token);
  if (!payload) {
    await clearAuthCookies();
    throw new ApiError("UNAUTHORIZED", "Oturum süresi doldu. Tekrar giriş yapın.");
  }

  const session = await findActiveSessionByToken(token);
  if (!session) {
    await revokeAllUserSessions(payload.sub);
    await clearAuthCookies();
    throw new ApiError("UNAUTHORIZED", "Oturum geçersiz. Tekrar giriş yapın.");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== UserStatus.ACTIVE) {
    await clearAuthCookies();
    throw new ApiError("UNAUTHORIZED", "Hesap aktif değil.");
  }

  const accessToken = await signAccessToken(user.id, user.role);
  const refreshToken = await signRefreshToken(user.id, user.role);
  await rotateSession(session.id, refreshToken);
  await setAuthCookies(accessToken, refreshToken);

  return user;
}

export const POST = withErrorHandling(async (req) => {
  await enforceRateLimit(RATE_LIMITS.refresh, clientIpFromRequest(req));
  const user = await rotate();
  return ok({ user: serializeUser(user) });
});

// Tarayıcı akışı: proxy.ts korumalı sayfada access token bulamayınca buraya
// yönlendirir; oturum geçerliyse token'lar yenilenip hedefe geri dönülür,
// değilse login'e gidilir.
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Açık yönlendirme (open redirect) engeli: değer aynı origin'e çözülmezse "/".
  const target = safeInternalPath(url.searchParams.get("redirect"), req.url);

  try {
    await enforceRateLimit(RATE_LIMITS.refresh, clientIpFromRequest(req));
    await rotate();
    return NextResponse.redirect(new URL(target, req.url));
  } catch {
    const loginUrl = new URL("/login", req.url);
    if (target !== "/") loginUrl.searchParams.set("next", target);
    return NextResponse.redirect(loginUrl);
  }
}
