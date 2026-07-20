import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import { CourseRole } from "@/lib/generated/prisma/enums";

type Params = { id: string; userId: string };

// Öğrenciyi dersten çıkarır (soft: leftAt işaretlenir; teslim/değerlendirme
// geçmişi korunur — NFR-3.5). Aynı öğrenci "Üye Ekle" ile geri alınabilir.
export const DELETE = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id, userId } = await params;

  const membership = await prisma.courseMembership.findUnique({
    where: { userId_courseId: { userId, courseId: id } },
  });
  if (!membership || membership.leftAt !== null) {
    throw new ApiError("NOT_FOUND", "Aktif üyelik bulunamadı.");
  }
  if (membership.role === CourseRole.TEACHER) {
    throw new ApiError("BUSINESS_RULE", "Öğretmen üyeliği dersten çıkarılamaz.");
  }

  const updated = await prisma.courseMembership.update({
    where: { id: membership.id },
    data: { leftAt: new Date() },
  });

  return ok({ membership: updated });
});
