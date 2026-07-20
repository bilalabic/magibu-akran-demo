import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import { UserRole } from "@/lib/generated/prisma/enums";
import {
  assertReviewerOrTeacher,
  getPeerAssignmentOrThrow,
  serializePeerAssignmentForStudent,
} from "@/server/services/peer-review-access";

type Params = { id: string };

// Değerlendirme görevi detayı: teslim içeriği + rubrik + mevcut taslak cevaplar.
// Öğrenci görünümünde teslim sahibi kimliği bulunmaz (FR-7.10 çift kör).
export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const peerAssignment = await getPeerAssignmentOrThrow(id);
  assertReviewerOrTeacher(user, peerAssignment);

  const rubric = await prisma.rubric.findUnique({
    where: { assignmentId: peerAssignment.assignmentId },
    include: { criteria: { orderBy: { order: "asc" } } },
  });

  const base = serializePeerAssignmentForStudent(peerAssignment);

  if (user.role === UserRole.TEACHER) {
    const [owner, reviewer] = await Promise.all([
      prisma.user.findUnique({
        where: { id: peerAssignment.submission.studentId },
        select: { id: true, name: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: peerAssignment.reviewerId },
        select: { id: true, name: true, email: true },
      }),
    ]);
    return ok({
      peerAssignment: { ...base, submissionOwner: owner, reviewer },
      rubric,
    });
  }

  return ok({ peerAssignment: base, rubric });
});
