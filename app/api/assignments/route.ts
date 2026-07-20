import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { AssignmentStatus, UserRole } from "@/lib/generated/prisma/enums";
import { assignmentListQuerySchema } from "@/lib/validation/assignment";
import { paginatedResult, toSkipTake } from "@/lib/validation/common";

// Öğretmen tüm ödevleri, öğrenci üye olduğu derslerin yayınlanmış ödevlerini görür.
export const GET = withErrorHandling(async (req) => {
  const user = await requireAuth();
  const url = new URL(req.url);
  const query = assignmentListQuerySchema.parse(Object.fromEntries(url.searchParams));

  const where: Prisma.AssignmentWhereInput = {
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(user.role === UserRole.STUDENT
      ? {
          status: query.status ?? { not: AssignmentStatus.DRAFT },
          course: {
            isActive: true,
            memberships: { some: { userId: user.id, leftAt: null } },
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.assignment.findMany({
      where,
      orderBy: [{ submissionEndsAt: "desc" }],
      ...toSkipTake(query),
      include: {
        course: { select: { id: true, name: true } },
        module: { select: { id: true, title: true, order: true } },
        _count: { select: { submissions: true, peerAssignments: true } },
        ...(user.role === UserRole.STUDENT
          ? {
              submissions: {
                where: { studentId: user.id },
                select: { id: true, status: true, submittedAt: true },
              },
            }
          : {}),
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  const serialized = items.map((assignment) => {
    const { submissions, ...rest } = assignment as typeof assignment & {
      submissions?: Array<{ id: string; status: string; submittedAt: Date | null }>;
    };
    return {
      ...rest,
      mySubmission: submissions?.[0] ?? null,
    };
  });

  return ok(paginatedResult(serialized, total, query));
});
