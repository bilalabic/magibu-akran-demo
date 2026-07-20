import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { WhitelistStatus } from "@/lib/generated/prisma/enums";
import { sendInvitation } from "@/server/services/whitelist-service";

type Params = { id: string };

// Daveti manuel yeniden gönderme. jobKey dakika bazında üretilir: aynı dakika
// içindeki tekrarlar mükerrer mail üretmez, sonraki denemeler yeni mail atar.
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const entry = await prisma.whitelistEntry.findUnique({ where: { id } });
  if (!entry) {
    throw new ApiError("NOT_FOUND", "White-list kaydı bulunamadı.");
  }
  if (entry.status !== WhitelistStatus.PENDING) {
    throw new ApiError("BUSINESS_RULE", "Yalnızca bekleyen kayıtlara davet gönderilebilir.");
  }

  const minuteStamp = new Date().toISOString().slice(0, 16);
  const jobKey = entry.invitedAt
    ? `invitation:${entry.id}:manual:${minuteStamp}`
    : undefined; // ilk davet: standart jobKey (invitation:{id})

  await sendInvitation(entry, jobKey);
  return ok({ sent: true });
});
