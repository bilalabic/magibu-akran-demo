import { verifyCronRequest } from "@/lib/cron/auth";
import { withJobLog } from "@/lib/cron/job-log";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import { ok, withErrorHandling } from "@/lib/errors";
import {
  AssignmentStatus,
  NotificationType,
  SubmissionStatus,
  UserRole,
} from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";
import { formatDateTimeTr } from "@/lib/utils/date";

// FR-8.5 / döküman 15.3: Teslim süresine 24 saat kala, teslim yapmamış
// öğrencilere hatırlatma. jobKey (assignmentId+userId) tekrarları engeller.
export const GET = withErrorHandling(async (req) => {
  await verifyCronRequest(req, "/api/cron/submission-reminders");

  const result = await withJobLog("submission-reminders", async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const assignments = await prisma.assignment.findMany({
      where: {
        status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.SUBMISSION_OPEN] },
        submissionEndsAt: { gt: now, lte: windowEnd },
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        submissionEndsAt: true,
      },
    });

    const payloads: EmailJobPayload[] = [];

    for (const assignment of assignments) {
      // Derse üye aktif öğrenciler
      const members = await prisma.courseMembership.findMany({
        where: {
          courseId: assignment.courseId,
          leftAt: null,
          role: "STUDENT",
          user: { role: UserRole.STUDENT, status: "ACTIVE" },
        },
        select: { user: { select: { id: true, name: true, email: true } } },
      });

      // Teslimini kesinleştirmiş öğrenciler hariç (DRAFT sahipleri de hatırlatılır)
      const submitted = await prisma.submission.findMany({
        where: {
          assignmentId: assignment.id,
          status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LOCKED] },
        },
        select: { studentId: true },
      });
      const submittedIds = new Set(submitted.map((s) => s.studentId));

      for (const { user } of members) {
        if (submittedIds.has(user.id)) continue;
        payloads.push(
          buildEmailPayload({
            jobKey: jobKeys.submissionReminder(assignment.id, user.id),
            type: NotificationType.SUBMISSION_REMINDER,
            to: user.email,
            recipientUserId: user.id,
            data: {
              name: user.name,
              assignmentTitle: assignment.title,
              endsAt: formatDateTimeTr(assignment.submissionEndsAt),
              assignmentUrl: `${appUrl()}/student/assignments/${assignment.id}`,
            },
          }),
        );
      }
    }

    await enqueueEmails(payloads);
    return { assignments: assignments.length, reminders: payloads.length };
  });

  return ok(result);
});
