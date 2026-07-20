import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { moduleUpdateSchema } from "@/lib/validation/course";

type Params = { id: string };

export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, moduleUpdateSchema);

  const courseModule = await prisma.assignmentModule.findUnique({ where: { id } });
  if (!courseModule) {
    throw new ApiError("NOT_FOUND", "Modül bulunamadı.");
  }

  if (body.order !== undefined && body.order !== courseModule.order) {
    const clash = await prisma.assignmentModule.findUnique({
      where: { courseId_order: { courseId: courseModule.courseId, order: body.order } },
    });
    if (clash) {
      throw new ApiError("CONFLICT", `Bu derste ${body.order} sıra numarası zaten kullanılıyor.`);
    }
  }

  const updated = await prisma.assignmentModule.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.order !== undefined ? { order: body.order } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return ok({ module: updated });
});
