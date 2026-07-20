import { createHash } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { clientIpFromRequest, enforceRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { resetPasswordSchema } from "@/lib/validation/auth";

export const POST = withErrorHandling(async (req) => {
  await enforceRateLimit(RATE_LIMITS.forgotPassword, clientIpFromRequest(req));

  const body = await parseJsonBody(req, resetPasswordSchema);
  const tokenHash = createHash("sha256").update(body.token).digest("hex");

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
    );
  }

  const passwordHash = await hashPassword(body.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
  });

  // Şifre değişince tüm aktif oturumlar düşürülür (NFR-1.9)
  await revokeAllUserSessions(resetToken.userId);

  return ok({ message: "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz." });
});
