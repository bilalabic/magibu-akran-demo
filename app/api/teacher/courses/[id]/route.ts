import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { courseUpdateSchema } from "@/lib/validation/course";

type Params = { id: string };

export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, courseUpdateSchema);

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return ok({ course: updated });
});

// Dersi kalıcı siler. Cascade: modüller, ödevler, teslimler, atamalar,
// değerlendirmeler ve üyelikler birlikte silinir — UI güçlü onay ister.
export const DELETE = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true, memberships: true } } },
  });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  await prisma.course.delete({ where: { id } });

  return ok({
    deleted: true,
    removedAssignments: course._count.assignments,
    removedMemberships: course._count.memberships,
  });
});
