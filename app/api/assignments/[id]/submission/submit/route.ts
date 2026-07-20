import { requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { SubmissionStatus } from "@/lib/generated/prisma/enums";
import {
  assertCanViewAssignment,
  getAssignmentOrThrow,
} from "@/server/services/assignment-access";

type Params = { id: string };

// Teslimi kesinleştirir (DRAFT → SUBMITTED). Süre bitmişse reddedilir.
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  const student = await requireStudent();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(student, assignment);

  const submission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
    include: { _count: { select: { links: true } } },
  });
  if (!submission) {
    throw new ApiError("NOT_FOUND", "Önce bir teslim oluşturmalısınız.");
  }
  if (submission.status === SubmissionStatus.SUBMITTED) {
    return ok({ submission }); // idempotent
  }
  if (submission.status === SubmissionStatus.LOCKED) {
    throw new ApiError("BUSINESS_RULE", "Teslim kilitli; değiştirilemez.");
  }
  if (new Date() >= assignment.submissionEndsAt) {
    throw new ApiError("BUSINESS_RULE", "Teslim süresi sona erdi.");
  }
  if (submission._count.links === 0) {
    throw new ApiError("BUSINESS_RULE", "Teslimde en az bir bağlantı olmalı.");
  }

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: { status: SubmissionStatus.SUBMITTED, submittedAt: new Date() },
  });

  return ok({ submission: updated });
});
