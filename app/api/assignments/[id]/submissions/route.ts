import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import { SubmissionStatus, UserRole } from "@/lib/generated/prisma/enums";
import { paginationSchema, paginatedResult, toSkipTake } from "@/lib/validation/common";
import {
  assertCanViewAssignment,
  getAssignmentOrThrow,
} from "@/server/services/assignment-access";

type Params = { id: string };

// FR-5.1/5.2: Ödev havuzu. Teslim süresi bitmeden de görüntülenebilir
// (kullanıcı kararı); FR-5.2'de sahibin adı listelenmediği için öğrenci
// görünümünde teslim sahibi kimliği yer almaz. Öğretmen tüm detayları
// (DRAFT'lar dahil) görür.
export const GET = withErrorHandling<Params>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const url = new URL(req.url);
  const query = paginationSchema.parse(Object.fromEntries(url.searchParams));

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(user, assignment);

  const isTeacher = user.role === UserRole.TEACHER;

  const where = {
    assignmentId: id,
    ...(isTeacher ? {} : { status: { not: SubmissionStatus.DRAFT } }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.submission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      ...toSkipTake(query),
      include: {
        links: { orderBy: { sortOrder: "asc" } },
        _count: { select: { comments: { where: { isDeleted: false } } } },
        ...(isTeacher
          ? { student: { select: { id: true, name: true, email: true } } }
          : {}),
      },
    }),
    prisma.submission.count({ where }),
  ]);

  const serialized = items.map((submission) => {
    const { student, studentId, ...rest } = submission as typeof submission & {
      student?: { id: string; name: string; email: string };
    };
    return {
      ...rest,
      commentCount: submission._count.comments,
      isMine: studentId === user.id,
      ...(isTeacher ? { student } : {}),
    };
  });

  return ok(paginatedResult(serialized, total, query));
});
