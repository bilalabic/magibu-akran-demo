import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { WhitelistStatus } from "@/lib/generated/prisma/enums";
import { whitelistUpdateSchema } from "@/lib/validation/whitelist";

type Params = { id: string };

export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, whitelistUpdateSchema);

  const entry = await prisma.whitelistEntry.findUnique({ where: { id } });
  if (!entry) {
    throw new ApiError("NOT_FOUND", "White-list kaydı bulunamadı.");
  }
  if (entry.status === WhitelistStatus.REGISTERED) {
    throw new ApiError("BUSINESS_RULE", "Kayıt olmuş kullanıcının white-list kaydı değiştirilemez.");
  }
  if (body.status === WhitelistStatus.PENDING && entry.status !== WhitelistStatus.REVOKED) {
    throw new ApiError("BUSINESS_RULE", "Yalnızca iptal edilmiş kayıt yeniden aktifleştirilebilir.");
  }

  const updated = await prisma.whitelistEntry.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.status !== undefined ? { status: body.status, revokedAt: null } : {}),
    },
  });

  return ok({ entry: updated });
});

// FR-2.7: Öğretmen white-list kaydını iptal eder (soft — REVOKED durumu).
export const DELETE = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const entry = await prisma.whitelistEntry.findUnique({ where: { id } });
  if (!entry) {
    throw new ApiError("NOT_FOUND", "White-list kaydı bulunamadı.");
  }
  if (entry.status === WhitelistStatus.REGISTERED) {
    throw new ApiError(
      "BUSINESS_RULE",
      "Kayıt olmuş kullanıcının white-list kaydı iptal edilemez. Gerekirse kullanıcı hesabını askıya alın.",
    );
  }
  if (entry.status === WhitelistStatus.REVOKED) {
    return ok({ entry });
  }

  const updated = await prisma.whitelistEntry.update({
    where: { id },
    data: { status: WhitelistStatus.REVOKED, revokedAt: new Date() },
  });

  return ok({ entry: updated });
});
