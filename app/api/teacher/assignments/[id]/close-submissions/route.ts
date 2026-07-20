import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { AssignmentStatus, SubmissionStatus } from "@/lib/generated/prisma/enums";
import { getAssignmentOrThrow } from "@/server/services/assignment-access";

type Params = { id: string };

// Teslim sürecini erken/manuel kapatır: durum SUBMISSION_CLOSED yapılır,
// gerekiyorsa bitiş tarihi şimdiye çekilir ve SUBMITTED teslimler kilitlenir.
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  const allowed: AssignmentStatus[] = [
    AssignmentStatus.PUBLISHED,
    AssignmentStatus.SUBMISSION_OPEN,
  ];
  if (!allowed.includes(assignment.status)) {
    throw new ApiError("BUSINESS_RULE", "Bu ödevin teslim süreci kapatılamaz.");
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.assignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.SUBMISSION_CLOSED,
        ...(assignment.submissionEndsAt > now ? { submissionEndsAt: now } : {}),
        // Tarih sırası bozulmasın: reviewStartsAt teslim bitişinden önce olamaz
        ...(assignment.reviewStartsAt < now ? { reviewStartsAt: now } : {}),
      },
    });

    await tx.submission.updateMany({
      where: { assignmentId: id, status: SubmissionStatus.SUBMITTED },
      data: { status: SubmissionStatus.LOCKED, lockedAt: now },
    });

    return result;
  });

  return ok({ assignment: updated });
});
