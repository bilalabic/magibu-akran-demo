import "server-only";

import { matchPeers, type MatchingWarning } from "@/lib/assignments/peer-matching";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import { ApiError } from "@/lib/errors";
import {
  AssignmentStatus,
  NotificationType,
  SubmissionStatus,
} from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";
import { formatDateTimeTr } from "@/lib/utils/date";

export type GenerateResult = {
  created: number;
  existing: number;
  totalSubmissions: number;
  targetPerReviewer: number;
  warnings: string[];
};

function warningToMessage(warning: MatchingWarning, nameById: Map<string, string>): string {
  switch (warning.type) {
    case "INSUFFICIENT_SUBMISSIONS":
      return warning.submissionCount === 0
        ? "Hiç teslim yok; akran değerlendirmesi yapılamaz."
        : "Yalnızca 1 teslim var; akran değerlendirmesi yapılamaz (en az 2 teslim gerekir).";
    case "REDUCED_TARGET":
      return `Teslim sayısı azlığı nedeniyle öğrenci başına görev sayısı ${warning.requested} yerine ${warning.target} olarak belirlendi.`;
    case "PARTIAL_ASSIGNMENT":
      return `${nameById.get(warning.reviewerId) ?? warning.reviewerId} için yalnızca ${warning.assigned}/${warning.target} görev atanabildi.`;
  }
}

// FR-6.8/6.9: transaction + idempotent atama üretimi. Hem öğretmen endpoint'i
// hem cron (döküman 15.2) bu servisi kullanır.
export async function generatePeerAssignments(assignmentId: string): Promise<GenerateResult> {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    throw new ApiError("NOT_FOUND", "Ödev bulunamadı.");
  }

  const now = new Date();
  if (now < assignment.submissionEndsAt) {
    throw new ApiError(
      "BUSINESS_RULE",
      "Teslim süresi bitmeden akran ataması yapılamaz. Önce teslimleri kapatın.",
    );
  }
  if (assignment.status === AssignmentStatus.DRAFT) {
    throw new ApiError("BUSINESS_RULE", "Taslak ödevde akran ataması yapılamaz.");
  }

  // FR-6.1 / 8.3: yalnızca SUBMITTED veya LOCKED teslimler
  const submissions = await prisma.submission.findMany({
    where: {
      assignmentId,
      status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LOCKED] },
    },
    select: { id: true, studentId: true, student: { select: { name: true, email: true } } },
  });

  const existing = await prisma.peerAssignment.findMany({
    where: { assignmentId },
    select: { reviewerId: true, submissionId: true },
  });

  const result = matchPeers({
    submissions: submissions.map((s) => ({ id: s.id, studentId: s.studentId })),
    requiredReviewCount: assignment.requiredReviewCount,
    existing,
  });

  const nameById = new Map(submissions.map((s) => [s.studentId, s.student.name]));
  const warnings = result.warnings.map((w) => warningToMessage(w, nameById));

  // FR-6.7: hiç atama üretilemiyorsa ve mevcut atama da yoksa uyarı ile dön
  if (result.newAssignments.length === 0) {
    return {
      created: 0,
      existing: existing.length,
      totalSubmissions: submissions.length,
      targetPerReviewer: result.targetPerReviewer,
      warnings,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.peerAssignment.createMany({
      data: result.newAssignments.map((a) => ({
        assignmentId,
        submissionId: a.submissionId,
        reviewerId: a.reviewerId,
        expiresAt: assignment.reviewEndsAt,
      })),
      skipDuplicates: true, // @@unique([assignmentId, reviewerId, submissionId]) koruması
    });

    // Değerlendirme penceresi açıldıysa durumu ilerlet
    if (
      assignment.status === AssignmentStatus.SUBMISSION_CLOSED &&
      now >= assignment.reviewStartsAt
    ) {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.REVIEW_OPEN },
      });
    }
  });

  // FR-6.10: öğrencilere asenkron bildirim (öğrenci başına tek e-posta)
  const perReviewer = new Map<string, number>();
  for (const a of result.newAssignments) {
    perReviewer.set(a.reviewerId, (perReviewer.get(a.reviewerId) ?? 0) + 1);
  }
  const studentById = new Map(
    submissions.map((s) => [s.studentId, { name: s.student.name, email: s.student.email }]),
  );

  const payloads: EmailJobPayload[] = [];
  for (const [reviewerId, count] of perReviewer) {
    const student = studentById.get(reviewerId);
    if (!student) continue;
    payloads.push(
      buildEmailPayload({
        jobKey: jobKeys.peerAssignmentBatch(assignmentId, reviewerId),
        type: NotificationType.PEER_ASSIGNMENT,
        to: student.email,
        recipientUserId: reviewerId,
        data: {
          name: student.name,
          assignmentTitle: assignment.title,
          count,
          dueAt: formatDateTimeTr(assignment.reviewEndsAt),
          reviewUrl: `${appUrl()}/student/reviews`,
        },
      }),
    );
  }
  await enqueueEmails(payloads);

  return {
    created: result.newAssignments.length,
    existing: existing.length,
    totalSubmissions: submissions.length,
    targetPerReviewer: result.targetPerReviewer,
    warnings,
  };
}
