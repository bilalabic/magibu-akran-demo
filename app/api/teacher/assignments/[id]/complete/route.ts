import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { AssignmentStatus, NotificationType } from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";
import { buildAssignmentReport } from "@/lib/reports/aggregate";

type Params = { id: string };

// Süreci tamamlar: REVIEW_CLOSED → COMPLETED.
// FR-8.9: öğrencilere sonuç karnesi, FR-8.10: öğretmene katılım/başarı özeti.
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  const teacher = await requireTeacher();
  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    throw new ApiError("NOT_FOUND", "Ödev bulunamadı.");
  }
  if (assignment.status !== AssignmentStatus.REVIEW_CLOSED) {
    throw new ApiError(
      "BUSINESS_RULE",
      "Yalnızca değerlendirme süreci kapatılmış ödev tamamlanabilir.",
    );
  }

  const report = await buildAssignmentReport(id);

  await prisma.assignment.update({
    where: { id },
    data: { status: AssignmentStatus.COMPLETED },
  });

  const payloads: EmailJobPayload[] = [];

  // Öğrenci karneleri (teslimi olanlara)
  for (const row of report.rows) {
    if (!row.submission || row.submission.status === "DRAFT") continue;
    payloads.push(
      buildEmailPayload({
        jobKey: jobKeys.studentReport(id, row.student.id),
        type: NotificationType.STUDENT_REPORT,
        to: row.student.email,
        recipientUserId: row.student.id,
        data: {
          name: row.student.name,
          assignmentTitle: report.assignment.title,
          overallAverage:
            row.overallAverage !== null ? row.overallAverage.toFixed(2) : null,
          reviewCount: row.completedReviewCount,
          resultsUrl: `${appUrl()}/student/results/${id}`,
        },
      }),
    );
  }

  // Öğretmen özeti
  payloads.push(
    buildEmailPayload({
      jobKey: jobKeys.teacherAssignmentSummary(id),
      type: NotificationType.TEACHER_WEEKLY_REPORT,
      to: teacher.email,
      recipientUserId: teacher.id,
      data: {
        title: `Ödev Tamamlandı: ${report.assignment.title}`,
        lines: [
          `Ders: ${report.courseName}${report.moduleTitle ? ` / ${report.moduleTitle}` : ""}`,
          `Öğrenci sayısı: ${report.stats.studentCount}`,
          `Teslim sayısı: ${report.stats.submittedCount}`,
          `Atanan değerlendirme: ${report.stats.assignedReviewCount}`,
          `Tamamlanan değerlendirme: ${report.stats.completedReviewCount}`,
          `Sınıf genel ortalaması: ${report.classOverallAverage !== null ? report.classOverallAverage.toFixed(2) : "—"}`,
        ],
        url: `${appUrl()}/teacher/assignments/${id}/reports`,
      },
    }),
  );

  await enqueueEmails(payloads);

  return ok({
    completed: true,
    notified: payloads.length,
    stats: report.stats,
  });
});
