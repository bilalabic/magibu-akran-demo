import { requireAuth } from "@/lib/auth/authorization";
import { isSubmissionWindowOpen } from "@/lib/assignments/status";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import { UserRole } from "@/lib/generated/prisma/enums";
import {
  assertCanViewAssignment,
  getAssignmentOrThrow,
} from "@/server/services/assignment-access";

type Params = { id: string };

export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(user, assignment);

  const [rubric, counts, mySubmission] = await Promise.all([
    prisma.rubric.findUnique({
      where: { assignmentId: id },
      include: { criteria: { orderBy: { order: "asc" } } },
    }),
    prisma.submission.count({ where: { assignmentId: id, status: { not: "DRAFT" } } }),
    user.role === UserRole.STUDENT
      ? prisma.submission.findUnique({
          where: { assignmentId_studentId: { assignmentId: id, studentId: user.id } },
          include: { links: { orderBy: { sortOrder: "asc" } } },
        })
      : Promise.resolve(null),
  ]);

  const [course, courseModule] = await Promise.all([
    prisma.course.findUnique({
      where: { id: assignment.courseId },
      select: { id: true, name: true },
    }),
    assignment.moduleId
      ? prisma.assignmentModule.findUnique({
          where: { id: assignment.moduleId },
          select: { id: true, title: true, order: true },
        })
      : Promise.resolve(null),
  ]);

  return ok({
    assignment: {
      ...assignment,
      course,
      module: courseModule,
      submittedCount: counts,
      submissionWindowOpen: isSubmissionWindowOpen(assignment.status, assignment, new Date()),
    },
    rubric,
    mySubmission,
  });
});
