import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import { UserRole } from "@/lib/generated/prisma/enums";
import {
  assertCanViewSubmission,
  getSubmissionOrThrow,
} from "@/server/services/submission-access";

type Params = { id: string };

export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const submission = await getSubmissionOrThrow(id);
  await assertCanViewSubmission(user, submission);

  const links = await prisma.submissionLink.findMany({
    where: { submissionId: id },
    orderBy: { sortOrder: "asc" },
  });

  const isTeacher = user.role === UserRole.TEACHER;
  const isOwner = submission.studentId === user.id;

  // Havuzda teslim sahibi kimliği öğrencilere gösterilmez (FR-5.2 alan listesi).
  const owner =
    isTeacher || isOwner
      ? await prisma.user.findUnique({
          where: { id: submission.studentId },
          select: { id: true, name: true, email: true },
        })
      : null;

  // studentId response'a sızmasın diye ayrıştırılır (öğrenci anonimliği)
  const { assignment, studentId, ...rest } = submission;
  void studentId;

  return ok({
    submission: {
      ...rest,
      links,
      isMine: isOwner,
      owner,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        courseId: assignment.courseId,
        submissionEndsAt: assignment.submissionEndsAt,
        reviewEndsAt: assignment.reviewEndsAt,
      },
    },
  });
});
