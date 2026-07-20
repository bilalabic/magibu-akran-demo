import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { UserRole } from "@/lib/generated/prisma/enums";
import { commentCreateSchema } from "@/lib/validation/submission";

type Params = { id: string };

// FR-5.7: Kullanıcı yalnızca kendi yorumunu düzenler.
export const PATCH = withErrorHandling<Params>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const body = await parseJsonBody(req, commentCreateSchema);

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || comment.isDeleted) {
    throw new ApiError("NOT_FOUND", "Yorum bulunamadı.");
  }
  if (comment.authorId !== user.id) {
    throw new ApiError("FORBIDDEN", "Yalnızca kendi yorumunuzu düzenleyebilirsiniz.");
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { content: body.content, editedAt: new Date() },
  });

  return ok({ comment: updated });
});

// FR-5.7 / FR-5.8: Sahibi veya öğretmen (moderasyon) siler — soft delete.
export const DELETE = withErrorHandling<Params>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment || comment.isDeleted) {
    throw new ApiError("NOT_FOUND", "Yorum bulunamadı.");
  }
  if (comment.authorId !== user.id && user.role !== UserRole.TEACHER) {
    throw new ApiError("FORBIDDEN", "Bu yorumu silme yetkiniz yok.");
  }

  await prisma.comment.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  return ok({ deleted: true });
});
