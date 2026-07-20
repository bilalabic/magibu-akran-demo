import { requireTeacher } from "@/lib/auth/authorization";
import { isAtOrAfter } from "@/lib/assignments/status";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { AssignmentStatus } from "@/lib/generated/prisma/enums";
import { assignmentUpdateSchema, DATE_ORDER_MESSAGE } from "@/lib/validation/assignment";
import { getAssignmentOrThrow } from "@/server/services/assignment-access";

type Params = { id: string };

// FR-3.5: Teslim süresi başlamış / teslim alınmış ödevlerde kritik alan
// değişiklikleri kontrollü yapılır:
//  - DRAFT'ta her şey serbest.
//  - Yayın sonrası: courseId asla değişmez; requiredReviewCount atamalar
//    oluşturulana kadar değişebilir; bitiş tarihleri yalnızca uzatılabilir;
//    başlangıç tarihleri ilgili aşama başladıysa değişemez.
export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, assignmentUpdateSchema);

  const assignment = await getAssignmentOrThrow(id);
  const isDraft = assignment.status === AssignmentStatus.DRAFT;
  const now = new Date();

  if (!isDraft) {
    const peerAssignmentCount = await prisma.peerAssignment.count({
      where: { assignmentId: id },
    });

    if (body.requiredReviewCount !== undefined && peerAssignmentCount > 0) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Akran atamaları oluşturulduktan sonra değerlendirme sayısı değiştirilemez.",
      );
    }
    if (
      body.submissionStartsAt !== undefined &&
      (now >= assignment.submissionStartsAt ||
        isAtOrAfter(assignment.status, AssignmentStatus.SUBMISSION_OPEN))
    ) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Teslim süreci başladıktan sonra başlangıç tarihi değiştirilemez.",
      );
    }
    if (
      body.submissionEndsAt !== undefined &&
      body.submissionEndsAt.getTime() < assignment.submissionEndsAt.getTime()
    ) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Yayınlanmış ödevde teslim bitişi yalnızca uzatılabilir.",
      );
    }
    if (
      body.submissionEndsAt !== undefined &&
      isAtOrAfter(assignment.status, AssignmentStatus.SUBMISSION_CLOSED)
    ) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Teslim süreci kapandıktan sonra teslim bitişi değiştirilemez.",
      );
    }
    if (
      body.reviewStartsAt !== undefined &&
      (peerAssignmentCount > 0 ||
        isAtOrAfter(assignment.status, AssignmentStatus.REVIEW_OPEN))
    ) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Değerlendirme süreci başladıktan sonra başlangıç tarihi değiştirilemez.",
      );
    }
    if (
      body.reviewEndsAt !== undefined &&
      body.reviewEndsAt.getTime() < assignment.reviewEndsAt.getTime()
    ) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Yayınlanmış ödevde değerlendirme bitişi yalnızca uzatılabilir.",
      );
    }
    if (
      body.reviewEndsAt !== undefined &&
      isAtOrAfter(assignment.status, AssignmentStatus.REVIEW_CLOSED)
    ) {
      throw new ApiError(
        "BUSINESS_RULE",
        "Değerlendirme süreci kapandıktan sonra bitiş tarihi değiştirilemez.",
      );
    }
  }

  if (body.moduleId) {
    const courseModule = await prisma.assignmentModule.findUnique({
      where: { id: body.moduleId },
    });
    if (!courseModule || courseModule.courseId !== assignment.courseId) {
      throw new ApiError("VALIDATION_ERROR", "Modül bu derse ait değil.");
    }
  }

  // Birleştirilmiş tarihlerin sırası hâlâ geçerli olmalı
  const merged = {
    submissionStartsAt: body.submissionStartsAt ?? assignment.submissionStartsAt,
    submissionEndsAt: body.submissionEndsAt ?? assignment.submissionEndsAt,
    reviewStartsAt: body.reviewStartsAt ?? assignment.reviewStartsAt,
    reviewEndsAt: body.reviewEndsAt ?? assignment.reviewEndsAt,
  };
  const orderValid =
    merged.submissionStartsAt < merged.submissionEndsAt &&
    merged.submissionEndsAt <= merged.reviewStartsAt &&
    merged.reviewStartsAt < merged.reviewEndsAt;
  if (!orderValid) {
    throw new ApiError("VALIDATION_ERROR", DATE_ORDER_MESSAGE);
  }

  const updated = await prisma.assignment.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.linkRules !== undefined ? { linkRules: body.linkRules } : {}),
      ...(body.moduleId !== undefined ? { moduleId: body.moduleId } : {}),
      ...(body.requiredReviewCount !== undefined
        ? { requiredReviewCount: body.requiredReviewCount }
        : {}),
      ...(body.isAnonymous !== undefined ? { isAnonymous: body.isAnonymous } : {}),
      submissionStartsAt: merged.submissionStartsAt,
      submissionEndsAt: merged.submissionEndsAt,
      reviewStartsAt: merged.reviewStartsAt,
      reviewEndsAt: merged.reviewEndsAt,
    },
  });

  return ok({ assignment: updated });
});

// Ödevi kalıcı siler. Cascade: rubrik, teslimler, atamalar ve değerlendirmeler
// birlikte silinir — UI güçlü onay ister.
export const DELETE = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true, peerAssignments: true } } },
  });
  if (!assignment) {
    throw new ApiError("NOT_FOUND", "Ödev bulunamadı.");
  }

  await prisma.assignment.delete({ where: { id } });

  return ok({
    deleted: true,
    removedSubmissions: assignment._count.submissions,
    removedPeerAssignments: assignment._count.peerAssignments,
  });
});
