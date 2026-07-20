import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { CriterionType } from "@/lib/generated/prisma/enums";
import { rubricUpsertSchema } from "@/lib/validation/assignment";
import { getAssignmentOrThrow } from "@/server/services/assignment-access";

type Params = { id: string };

export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  await getAssignmentOrThrow(id);

  const rubric = await prisma.rubric.findUnique({
    where: { assignmentId: id },
    include: { criteria: { orderBy: { order: "asc" } } },
  });
  return ok({ rubric });
});

// FR-7.1: Rubrik tanımlama/güncelleme. Değerlendirme cevapları oluşmaya
// başladıktan sonra rubrik değiştirilemez (veri bütünlüğü).
export const PUT = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, rubricUpsertSchema);

  await getAssignmentOrThrow(id);

  const reviewCount = await prisma.peerReview.count({
    where: { peerAssignment: { assignmentId: id } },
  });
  if (reviewCount > 0) {
    throw new ApiError(
      "BUSINESS_RULE",
      "Değerlendirmeler başladıktan sonra rubrik değiştirilemez.",
    );
  }

  const rubric = await prisma.$transaction(async (tx) => {
    const upserted = await tx.rubric.upsert({
      where: { assignmentId: id },
      update: { title: body.title, description: body.description ?? null },
      create: { assignmentId: id, title: body.title, description: body.description ?? null },
    });

    // Sıra numaraları dizideki konumdan türetilir; @@unique([rubricId, order])
    // çakışmasını önlemek için önce mevcut kriterler silinir.
    await tx.rubricCriterion.deleteMany({ where: { rubricId: upserted.id } });
    await tx.rubricCriterion.createMany({
      data: body.criteria.map((criterion, index) => ({
        rubricId: upserted.id,
        title: criterion.title,
        description: criterion.description ?? null,
        type: criterion.type,
        required: criterion.required,
        order: index + 1,
        minScore:
          criterion.type === CriterionType.SCORE ? (criterion.minScore ?? 1) : null,
        maxScore:
          criterion.type === CriterionType.SCORE ? (criterion.maxScore ?? 10) : null,
        weight: criterion.weight ?? null,
      })),
    });

    return tx.rubric.findUniqueOrThrow({
      where: { id: upserted.id },
      include: { criteria: { orderBy: { order: "asc" } } },
    });
  });

  return ok({ rubric });
});
