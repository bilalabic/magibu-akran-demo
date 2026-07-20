import { requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import { paginationSchema, paginatedResult, toSkipTake } from "@/lib/validation/common";

// Öğrencinin kendi değerlendirme görevleri. Teslim sahibi kimliği yer almaz.
export const GET = withErrorHandling(async (req) => {
  const student = await requireStudent();
  const url = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(url.searchParams));

  const where = { reviewerId: student.id };
  const [items, total] = await prisma.$transaction([
    prisma.peerAssignment.findMany({
      where,
      orderBy: [{ expiresAt: "asc" }, { assignedAt: "asc" }],
      ...toSkipTake(query),
      include: {
        assignment: { select: { id: true, title: true, reviewEndsAt: true, status: true } },
        submission: { select: { id: true, title: true } },
        review: { select: { id: true, status: true, submittedAt: true } },
      },
    }),
    prisma.peerAssignment.count({ where }),
  ]);

  const serialized = items.map((pa) => ({
    id: pa.id,
    status: pa.status,
    assignedAt: pa.assignedAt,
    expiresAt: pa.expiresAt,
    assignment: pa.assignment,
    submission: pa.submission,
    review: pa.review,
  }));

  return ok(paginatedResult(serialized, total, query));
});
