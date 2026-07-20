import { verifyCronRequest } from "@/lib/cron/auth";
import { withJobLog } from "@/lib/cron/job-log";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import { ok, withErrorHandling } from "@/lib/errors";
import { NotificationType, PeerAssignmentStatus } from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";
import { formatDateTimeTr } from "@/lib/utils/date";

// FR-8.6 / döküman 15.4: Değerlendirme süresine 12 saat kala, tamamlanmamış
// görevler için hatırlatma. jobKey (peerAssignmentId) tekrarları engeller.
export const GET = withErrorHandling(async (req) => {
  await verifyCronRequest(req, "/api/cron/review-reminders");

  const result = await withJobLog("review-reminders", async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const pending = await prisma.peerAssignment.findMany({
      where: {
        status: { in: [PeerAssignmentStatus.ASSIGNED, PeerAssignmentStatus.IN_PROGRESS] },
        assignment: { reviewEndsAt: { gt: now, lte: windowEnd } },
      },
      include: {
        assignment: { select: { title: true, reviewEndsAt: true } },
        reviewer: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    const payloads: EmailJobPayload[] = [];
    for (const pa of pending) {
      if (pa.reviewer.status !== "ACTIVE") continue;
      payloads.push(
        buildEmailPayload({
          jobKey: jobKeys.reviewReminder(pa.id),
          type: NotificationType.REVIEW_REMINDER,
          to: pa.reviewer.email,
          recipientUserId: pa.reviewer.id,
          data: {
            name: pa.reviewer.name,
            assignmentTitle: pa.assignment.title,
            endsAt: formatDateTimeTr(pa.assignment.reviewEndsAt),
            reviewUrl: `${appUrl()}/student/reviews/${pa.id}`,
          },
        }),
      );
    }

    await enqueueEmails(payloads);
    return { pendingTasks: pending.length, reminders: payloads.length };
  });

  return ok(result);
});
