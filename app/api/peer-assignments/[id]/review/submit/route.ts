import { requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import {
  NotificationType,
  PeerAssignmentStatus,
  PeerReviewStatus,
} from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";
import { validateReviewAnswers } from "@/lib/reviews/validate-answers";
import { reviewAnswersSchema } from "@/lib/validation/review";
import {
  assertReviewerOrTeacher,
  assertReviewWindowOpen,
  getPeerAssignmentOrThrow,
} from "@/server/services/peer-review-access";

type Params = { id: string };

// FR-7.8/7.9: Kesin gönderim — tüm zorunlu kriterler doğrulanır, kayıt kilitlenir.
// FR-8.3/8.4: teslim sahibine anonim bildirim + öğretmene özet bildirim.
export const POST = withErrorHandling<Params>(async (req, { params }) => {
  const student = await requireStudent();
  const { id } = await params;

  // Gövde opsiyoneldir: gönderilirse son cevaplar da kaydedilir.
  let bodyAnswers: { answers: Array<{ criterionId: string; score?: number | null; textValue?: string | null }> } | null = null;
  const contentLength = req.headers.get("content-length");
  if (contentLength && contentLength !== "0") {
    bodyAnswers = await parseJsonBody(req, reviewAnswersSchema);
  }

  const peerAssignment = await getPeerAssignmentOrThrow(id);
  assertReviewerOrTeacher(student, peerAssignment);
  assertReviewWindowOpen(peerAssignment);

  if (peerAssignment.review?.status === PeerReviewStatus.SUBMITTED) {
    throw new ApiError("BUSINESS_RULE", "Bu değerlendirme zaten kesin gönderilmiş.");
  }

  const criteria = await prisma.rubricCriterion.findMany({
    where: { rubric: { assignmentId: peerAssignment.assignmentId } },
  });

  // Son cevap seti: istekle gelen ya da kayıtlı taslak
  const answers =
    bodyAnswers?.answers ??
    (peerAssignment.review?.answers ?? []).map((a) => ({
      criterionId: a.criterionId,
      score: a.score,
      textValue: a.textValue,
    }));

  const validation = validateReviewAnswers({ criteria, answers, final: true });
  if (!validation.valid) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Değerlendirme gönderilemedi. Zorunlu alanları kontrol edin.",
      validation.errors,
    );
  }

  const now = new Date();
  const review = await prisma.$transaction(async (tx) => {
    const upserted = await tx.peerReview.upsert({
      where: { peerAssignmentId: peerAssignment.id },
      update: { status: PeerReviewStatus.SUBMITTED, submittedAt: now },
      create: {
        peerAssignmentId: peerAssignment.id,
        reviewerId: peerAssignment.reviewerId,
        status: PeerReviewStatus.SUBMITTED,
        submittedAt: now,
      },
    });

    await tx.reviewAnswer.deleteMany({ where: { peerReviewId: upserted.id } });
    await tx.reviewAnswer.createMany({
      data: validation.answers.map((answer) => ({
        peerReviewId: upserted.id,
        criterionId: answer.criterionId,
        score: answer.score,
        textValue: answer.textValue,
      })),
    });

    await tx.peerAssignment.update({
      where: { id: peerAssignment.id },
      data: { status: PeerAssignmentStatus.COMPLETED, completedAt: now },
    });

    return upserted;
  });

  // Bildirimler (asenkron, akışı bloklamaz)
  const [owner, teacher, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: peerAssignment.submission.studentId },
      select: { id: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: peerAssignment.assignment.createdById },
      select: { id: true, email: true },
    }),
    prisma.peerAssignment.groupBy({
      by: ["status"],
      where: { assignmentId: peerAssignment.assignmentId },
      _count: true,
    }),
  ]);

  const totalCount = progress.reduce((sum, p) => sum + p._count, 0);
  const completedCount =
    progress.find((p) => p.status === PeerAssignmentStatus.COMPLETED)?._count ?? 0;

  const payloads: EmailJobPayload[] = [];
  if (owner) {
    payloads.push(
      buildEmailPayload({
        jobKey: jobKeys.reviewCompletedOwner(review.id),
        type: NotificationType.REVIEW_COMPLETED_OWNER,
        to: owner.email,
        recipientUserId: owner.id,
        data: {
          assignmentTitle: peerAssignment.assignment.title,
          resultsUrl: `${appUrl()}/student/results/${peerAssignment.assignmentId}`,
        },
      }),
    );
  }
  if (teacher) {
    payloads.push(
      buildEmailPayload({
        jobKey: jobKeys.reviewCompletedTeacher(review.id),
        type: NotificationType.REVIEW_COMPLETED_TEACHER,
        to: teacher.email,
        recipientUserId: teacher.id,
        data: {
          assignmentTitle: peerAssignment.assignment.title,
          submissionTitle: peerAssignment.submission.title,
          reviewerName: student.name,
          completedCount,
          totalCount,
        },
      }),
    );
  }
  await enqueueEmails(payloads);

  return ok({
    review: { id: review.id, status: review.status, submittedAt: review.submittedAt },
    progress: { completedCount, totalCount },
  });
});
