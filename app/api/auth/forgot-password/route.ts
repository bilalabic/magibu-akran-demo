import { createHash, randomBytes } from "node:crypto";

import { clientIpFromRequest, enforceRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload } from "@/lib/email/process";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { NotificationType, UserStatus } from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmail } from "@/lib/jobs/qstash";
import { normalizeEmail } from "@/lib/utils/email";
import { forgotPasswordSchema } from "@/lib/validation/auth";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat

// Kullanıcı sayımını engellemek için sonuç her durumda başarılıdır.
export const POST = withErrorHandling(async (req) => {
  const ip = clientIpFromRequest(req);
  const body = await parseJsonBody(req, forgotPasswordSchema);
  const email = normalizeEmail(body.email);

  await enforceRateLimit(RATE_LIMITS.forgotPassword, `${email}:${ip}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === UserStatus.ACTIVE) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const token = await prisma.$transaction(async (tx) => {
      // Önceki kullanılmamış token'ları geçersiz kıl
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
    });

    await enqueueEmail(
      buildEmailPayload({
        jobKey: jobKeys.passwordReset(token.id),
        type: NotificationType.PASSWORD_RESET,
        to: user.email,
        recipientUserId: user.id,
        data: { resetUrl: `${appUrl()}/reset-password?token=${rawToken}` },
      }),
    );
  }

  return ok({
    message: "Bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.",
  });
});
