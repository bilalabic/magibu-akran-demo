import { setAuthCookies } from "@/lib/auth/cookies";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { clientIpFromRequest, enforceRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { normalizeEmail } from "@/lib/utils/email";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser, serializeUser } from "@/server/services/auth-service";

export const POST = withErrorHandling(async (req) => {
  const ip = clientIpFromRequest(req);
  await enforceRateLimit(RATE_LIMITS.register, ip);

  const body = await parseJsonBody(req, registerSchema);
  const email = normalizeEmail(body.email);

  const user = await registerUser({ email, name: body.name.trim(), password: body.password });

  // Kayıt sonrası otomatik giriş
  const accessToken = await signAccessToken(user.id, user.role);
  const refreshToken = await signRefreshToken(user.id, user.role);
  await createSession({
    userId: user.id,
    refreshToken,
    userAgent: req.headers.get("user-agent"),
    ipAddress: ip,
  });
  await setAuthCookies(accessToken, refreshToken);

  return ok({ user: serializeUser(user) }, { status: 201 });
});
