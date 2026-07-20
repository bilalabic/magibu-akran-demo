import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { AssignmentStatus } from "@/lib/generated/prisma/enums";
import { getAssignmentOrThrow } from "@/server/services/assignment-access";

type Params = { id: string };

// FR-3.4: Ödevi yayınlama. Teslim penceresi zaten açıldıysa doğrudan
// SUBMISSION_OPEN durumuna geçilir.
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  if (assignment.status !== AssignmentStatus.DRAFT) {
    throw new ApiError("BUSINESS_RULE", "Yalnızca taslak ödev yayınlanabilir.");
  }

  const rubric = await prisma.rubric.findUnique({
    where: { assignmentId: id },
    include: { _count: { select: { criteria: true } } },
  });
  if (!rubric || rubric._count.criteria === 0) {
    throw new ApiError("BUSINESS_RULE", "Yayınlamadan önce rubrik tanımlanmalıdır.");
  }

  const now = new Date();
  if (now >= assignment.submissionEndsAt) {
    throw new ApiError(
      "BUSINESS_RULE",
      "Teslim bitiş tarihi geçmiş bir ödev yayınlanamaz. Önce tarihleri güncelleyin.",
    );
  }

  const nextStatus =
    now >= assignment.submissionStartsAt
      ? AssignmentStatus.SUBMISSION_OPEN
      : AssignmentStatus.PUBLISHED;

  const updated = await prisma.assignment.update({
    where: { id },
    data: { status: nextStatus },
  });

  return ok({ assignment: updated });
});
