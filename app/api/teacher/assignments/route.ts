import { requireTeacher } from "@/lib/auth/authorization";
import { DEFAULT_RUBRIC } from "@/lib/assignments/default-rubric";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { assignmentCreateSchema } from "@/lib/validation/assignment";

// FR-3.2/3.3: Taslak ödev oluşturma. Varsayılan rubrik otomatik eklenir
// (FR-7.3/7.5); öğretmen rubrik endpoint'inden özelleştirebilir.
export const POST = withErrorHandling(async (req) => {
  const teacher = await requireTeacher();
  const body = await parseJsonBody(req, assignmentCreateSchema);

  const course = await prisma.course.findUnique({ where: { id: body.courseId } });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  if (body.moduleId) {
    const courseModule = await prisma.assignmentModule.findUnique({
      where: { id: body.moduleId },
    });
    if (!courseModule || courseModule.courseId !== body.courseId) {
      throw new ApiError("VALIDATION_ERROR", "Modül bu derse ait değil.");
    }
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        title: body.title,
        description: body.description,
        linkRules: body.linkRules ?? null,
        courseId: body.courseId,
        moduleId: body.moduleId ?? null,
        createdById: teacher.id,
        requiredReviewCount: body.requiredReviewCount,
        isAnonymous: body.isAnonymous,
        submissionStartsAt: body.submissionStartsAt,
        submissionEndsAt: body.submissionEndsAt,
        reviewStartsAt: body.reviewStartsAt,
        reviewEndsAt: body.reviewEndsAt,
      },
    });

    await tx.rubric.create({
      data: {
        assignmentId: created.id,
        title: DEFAULT_RUBRIC.title,
        description: DEFAULT_RUBRIC.description,
        criteria: {
          create: DEFAULT_RUBRIC.criteria.map((criterion) => ({ ...criterion })),
        },
      },
    });

    return created;
  });

  return ok({ assignment }, { status: 201 });
});
