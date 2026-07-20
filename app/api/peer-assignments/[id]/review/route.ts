import { requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { PeerAssignmentStatus, PeerReviewStatus } from "@/lib/generated/prisma/enums";
import { validateReviewAnswers } from "@/lib/reviews/validate-answers";
import { reviewAnswersSchema } from "@/lib/validation/review";
import {
  assertReviewerOrTeacher,
  assertReviewWindowOpen,
  getPeerAssignmentOrThrow,
} from "@/server/services/peer-review-access";

type Params = { id: string };

// FR-7.7: Taslak kaydetme (POST oluşturur, PATCH günceller — ikisi de aynı
// upsert davranışını kullanır; cevaplar transaction içinde yenilenir).
async function saveDraft(req: Request, id: string) {
  const student = await requireStudent();
  const body = await parseJsonBody(req, reviewAnswersSchema);

  const peerAssignment = await getPeerAssignmentOrThrow(id);
  assertReviewerOrTeacher(student, peerAssignment);
  assertReviewWindowOpen(peerAssignment);

  if (peerAssignment.review?.status === PeerReviewStatus.SUBMITTED) {
    throw new ApiError("BUSINESS_RULE", "Kesin gönderilmiş değerlendirme değiştirilemez.");
  }

  const criteria = await prisma.rubricCriterion.findMany({
    where: { rubric: { assignmentId: peerAssignment.assignmentId } },
  });
  const validation = validateReviewAnswers({
    criteria,
    answers: body.answers,
    final: false,
  });
  if (!validation.valid) {
    throw new ApiError("VALIDATION_ERROR", "Cevaplar geçersiz.", validation.errors);
  }

  const review = await prisma.$transaction(async (tx) => {
    const upserted = await tx.peerReview.upsert({
      where: { peerAssignmentId: peerAssignment.id },
      update: {},
      create: {
        peerAssignmentId: peerAssignment.id,
        reviewerId: peerAssignment.reviewerId,
      },
    });

    await tx.reviewAnswer.deleteMany({ where: { peerReviewId: upserted.id } });
    if (validation.answers.length > 0) {
      await tx.reviewAnswer.createMany({
        data: validation.answers.map((answer) => ({
          peerReviewId: upserted.id,
          criterionId: answer.criterionId,
          score: answer.score,
          textValue: answer.textValue,
        })),
      });
    }

    if (peerAssignment.status === PeerAssignmentStatus.ASSIGNED) {
      await tx.peerAssignment.update({
        where: { id: peerAssignment.id },
        data: { status: PeerAssignmentStatus.IN_PROGRESS, startedAt: new Date() },
      });
    }

    return tx.peerReview.findUniqueOrThrow({
      where: { id: upserted.id },
      include: { answers: true },
    });
  });

  return ok({
    review: {
      id: review.id,
      status: review.status,
      submittedAt: review.submittedAt,
      answers: review.answers.map((a) => ({
        criterionId: a.criterionId,
        score: a.score,
        textValue: a.textValue,
      })),
    },
  });
}

export const POST = withErrorHandling<Params>(async (req, { params }) => {
  const { id } = await params;
  return saveDraft(req, id);
});

export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  const { id } = await params;
  return saveDraft(req, id);
});
