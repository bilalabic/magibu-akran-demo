import { verifyCronRequest } from "@/lib/cron/auth";
import { withJobLog } from "@/lib/cron/job-log";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import { ok, withErrorHandling } from "@/lib/errors";
import {
  AssignmentStatus,
  NotificationType,
  PeerReviewStatus,
  SubmissionStatus,
  UserRole,
} from "@/lib/generated/prisma/enums";
import { isoWeekKey, jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";

// Haftalık öğretmen raporu (FR: haftalık katılım ve başarı raporu).
// jobKey ISO hafta anahtarı içerir: aynı hafta ikinci kez gönderilmez.
export const GET = withErrorHandling(async (req) => {
  await verifyCronRequest(req, "/api/cron/weekly-teacher-report");

  const result = await withJobLog("weekly-teacher-report", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const week = isoWeekKey(now);

    const [teachers, newSubmissions, completedReviews, activeAssignments, newStudents] =
      await Promise.all([
        prisma.user.findMany({
          where: { role: UserRole.TEACHER, status: "ACTIVE" },
          select: { id: true, email: true },
        }),
        prisma.submission.count({
          where: {
            submittedAt: { gte: weekAgo },
            status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LOCKED] },
          },
        }),
        prisma.peerReview.count({
          where: { status: PeerReviewStatus.SUBMITTED, submittedAt: { gte: weekAgo } },
        }),
        prisma.assignment.findMany({
          where: {
            status: {
              in: [
                AssignmentStatus.PUBLISHED,
                AssignmentStatus.SUBMISSION_OPEN,
                AssignmentStatus.SUBMISSION_CLOSED,
                AssignmentStatus.REVIEW_OPEN,
              ],
            },
          },
          select: { title: true, status: true },
        }),
        prisma.user.count({
          where: { role: UserRole.STUDENT, createdAt: { gte: weekAgo } },
        }),
      ]);

    const statusTr: Record<string, string> = {
      PUBLISHED: "Yayında",
      SUBMISSION_OPEN: "Teslim açık",
      SUBMISSION_CLOSED: "Teslim kapandı",
      REVIEW_OPEN: "Değerlendirme açık",
    };

    const lines = [
      `Son 7 günde ${newSubmissions} teslim yapıldı, ${completedReviews} akran değerlendirmesi tamamlandı.`,
      `Yeni kayıt olan öğrenci: ${newStudents}`,
      activeAssignments.length > 0
        ? `Aktif ödevler: ${activeAssignments
            .map((a) => `${a.title} (${statusTr[a.status] ?? a.status})`)
            .join(", ")}`
        : "Şu anda aktif ödev yok.",
    ];

    const payloads: EmailJobPayload[] = teachers.map((teacher) =>
      buildEmailPayload({
        jobKey: `${jobKeys.teacherWeeklyReport(week)}:${teacher.id}`,
        type: NotificationType.TEACHER_WEEKLY_REPORT,
        to: teacher.email,
        recipientUserId: teacher.id,
        data: {
          title: `Haftalık Özet (${week})`,
          lines,
          url: `${appUrl()}/teacher`,
        },
      }),
    );

    await enqueueEmails(payloads);
    return { teachers: teachers.length, week, sent: payloads.length };
  });

  return ok(result);
});
