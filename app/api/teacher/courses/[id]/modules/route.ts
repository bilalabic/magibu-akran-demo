import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { moduleCreateSchema } from "@/lib/validation/course";

type Params = { id: string };

// FR-3.1: Haftalık veya konu bazlı modül oluşturma.
export const POST = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, moduleCreateSchema);

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  const courseModule = await prisma.$transaction(async (tx) => {
    let order = body.order;
    if (order === undefined) {
      const last = await tx.assignmentModule.findFirst({
        where: { courseId: id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (last?.order ?? 0) + 1;
    } else {
      const clash = await tx.assignmentModule.findUnique({
        where: { courseId_order: { courseId: id, order } },
      });
      if (clash) {
        throw new ApiError("CONFLICT", `Bu derste ${order} sıra numarası zaten kullanılıyor.`);
      }
    }

    return tx.assignmentModule.create({
      data: {
        courseId: id,
        title: body.title,
        description: body.description ?? null,
        order,
      },
    });
  });

  return ok({ module: courseModule }, { status: 201 });
});
