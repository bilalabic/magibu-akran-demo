import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { AssignmentStatus, PeerAssignmentStatus } from "@/lib/generated/prisma/enums";
import { getAssignmentOrThrow } from "@/server/services/assignment-access";

type Params = { id: string };

// Değerlendirme sürecini kapatır: tamamlanmamış görevler EXPIRED işaretlenir.
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  const allowed: AssignmentStatus[] = [
    AssignmentStatus.SUBMISSION_CLOSED,
    AssignmentStatus.REVIEW_OPEN,
  ];
  if (!allowed.includes(assignment.status)) {
    throw new ApiError("BUSINESS_RULE", "Bu ödevin değerlendirme süreci kapatılamaz.");
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.assignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.REVIEW_CLOSED,
        ...(assignment.reviewEndsAt > now ? { reviewEndsAt: now } : {}),
      },
    });

    await tx.peerAssignment.updateMany({
      where: {
        assignmentId: id,
        status: { in: [PeerAssignmentStatus.ASSIGNED, PeerAssignmentStatus.IN_PROGRESS] },
      },
      data: { status: PeerAssignmentStatus.EXPIRED },
    });

    return result;
  });

  return ok({ assignment: updated });
});
