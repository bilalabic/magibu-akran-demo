import { requireStudent } from "@/lib/auth/authorization";
import { isSubmissionWindowOpen } from "@/lib/assignments/status";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { SubmissionStatus } from "@/lib/generated/prisma/enums";
import { submissionUpsertSchema } from "@/lib/validation/submission";
import {
  assertCanViewAssignment,
  getAssignmentOrThrow,
} from "@/server/services/assignment-access";

type Params = { id: string };

// Öğrencinin bu ödevdeki kendi teslimi.
export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const student = await requireStudent();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(student, assignment);

  const submission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
    include: { links: { orderBy: { sortOrder: "asc" } } },
  });

  return ok({ submission });
});

// FR-4.11: Aynı ödev için tek aktif teslim. Teslim DRAFT olarak oluşturulur,
// /submission/submit ile kesinleştirilir.
export const POST = withErrorHandling<Params>(async (req, { params }) => {
  const student = await requireStudent();
  const { id } = await params;
  const body = await parseJsonBody(req, submissionUpsertSchema);

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(student, assignment);

  if (!isSubmissionWindowOpen(assignment.status, assignment, new Date())) {
    throw new ApiError("BUSINESS_RULE", "Bu ödevin teslim süresi aktif değil.");
  }

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
  });
  if (existing) {
    throw new ApiError(
      "CONFLICT",
      "Bu ödev için zaten bir tesliminiz var. Güncellemek için mevcut teslimi düzenleyin.",
    );
  }

  const submission = await prisma.submission.create({
    data: {
      assignmentId: id,
      studentId: student.id,
      title: body.title,
      description: body.description,
      links: {
        create: body.links.map((link, index) => ({
          label: link.label?.trim() ? link.label.trim() : null,
          url: link.url.trim(),
          sortOrder: index,
        })),
      },
    },
    include: { links: { orderBy: { sortOrder: "asc" } } },
  });

  return ok({ submission }, { status: 201 });
});

// FR-4.9 / FR-4.10: Süre bitene kadar güncellenebilir; sonrası reddedilir.
// Bağlantılar transaction içinde yeniden oluşturulur (döküman 8.2).
export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  const student = await requireStudent();
  const { id } = await params;
  const body = await parseJsonBody(req, submissionUpsertSchema);

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(student, assignment);

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
  });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Güncellenecek teslim bulunamadı.");
  }

  const now = new Date();
  if (existing.status === SubmissionStatus.LOCKED || now >= assignment.submissionEndsAt) {
    throw new ApiError("BUSINESS_RULE", "Teslim süresi sona erdi; teslim değiştirilemez.");
  }

  const submission = await prisma.$transaction(async (tx) => {
    await tx.submissionLink.deleteMany({ where: { submissionId: existing.id } });
    return tx.submission.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        description: body.description,
        links: {
          create: body.links.map((link, index) => ({
            label: link.label?.trim() ? link.label.trim() : null,
            url: link.url.trim(),
            sortOrder: index,
          })),
        },
      },
      include: { links: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return ok({ submission });
});
