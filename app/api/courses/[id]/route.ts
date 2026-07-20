import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { AssignmentStatus, UserRole } from "@/lib/generated/prisma/enums";

type Params = { id: string };

export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: { where: { isActive: true }, orderBy: { order: "asc" } },
      _count: { select: { memberships: true, assignments: true } },
    },
  });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  if (user.role !== UserRole.TEACHER) {
    const membership = await prisma.courseMembership.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: id } },
    });
    if (!membership || membership.leftAt !== null || !course.isActive) {
      throw new ApiError("FORBIDDEN", "Bu derse erişiminiz yok.");
    }
  }

  // Öğrenci yalnızca yayınlanmış ödevleri görür
  const assignments = await prisma.assignment.findMany({
    where: {
      courseId: id,
      ...(user.role === UserRole.TEACHER
        ? {}
        : { status: { not: AssignmentStatus.DRAFT } }),
    },
    orderBy: { submissionEndsAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      moduleId: true,
      submissionStartsAt: true,
      submissionEndsAt: true,
      reviewStartsAt: true,
      reviewEndsAt: true,
    },
  });

  return ok({ course, assignments });
});
