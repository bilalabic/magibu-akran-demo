import { setAuthCookies } from "@/lib/auth/cookies";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { clientIpFromRequest, enforceRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { UserStatus } from "@/lib/generated/prisma/enums";
import { normalizeEmail } from "@/lib/utils/email";
import { loginSchema } from "@/lib/validation/auth";
import { serializeUser } from "@/server/services/auth-service";

// Kullanıcı sayımını (enumeration) engellemek için tüm hatalarda aynı mesaj döner.
const INVALID_CREDENTIALS = new ApiError("UNAUTHORIZED", "E-posta veya şifre hatalı.");

export const POST = withErrorHandling(async (req) => {
  const ip = clientIpFromRequest(req);
  const body = await parseJsonBody(req, loginSchema);
  const email = normalizeEmail(body.email);

  await enforceRateLimit(RATE_LIMITS.login, `${email}:${ip}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw INVALID_CREDENTIALS;
  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError("FORBIDDEN", "Hesabınız aktif değil. Öğretmeninizle iletişime geçin.");
  }

  const passwordValid = await verifyPassword(body.password, user.passwordHash);
  if (!passwordValid) throw INVALID_CREDENTIALS;

  const accessToken = await signAccessToken(user.id, user.role);
  const refreshToken = await signRefreshToken(user.id, user.role);
  await createSession({
    userId: user.id,
    refreshToken,
    userAgent: req.headers.get("user-agent"),
    ipAddress: ip,
  });
  await setAuthCookies(accessToken, refreshToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return ok({ user: serializeUser(user) });
});
