import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import { UserRole } from "@/lib/generated/prisma/enums";

// Öğretmen tüm dersleri, öğrenci üyesi olduğu aktif dersleri görür.
export const GET = withErrorHandling(async () => {
  const user = await requireAuth();

  if (user.role === UserRole.TEACHER) {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true, assignments: true, modules: true } },
      },
    });
    return ok({ courses });
  }

  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      memberships: { some: { userId: user.id, leftAt: null } },
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { assignments: true, modules: true } } },
  });
  return ok({ courses });
});
