import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { CourseRole } from "@/lib/generated/prisma/enums";
import { courseCreateSchema } from "@/lib/validation/course";

export const POST = withErrorHandling(async (req) => {
  const teacher = await requireTeacher();
  const body = await parseJsonBody(req, courseCreateSchema);

  // Ders oluşturulurken öğretmen otomatik üye olur; kayıtlı tüm aktif
  // öğrenciler de derse eklenir (otomatik üyelik kararıyla tutarlı).
  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        createdById: teacher.id,
      },
    });

    await tx.courseMembership.create({
      data: { courseId: created.id, userId: teacher.id, role: CourseRole.TEACHER },
    });

    const students = await tx.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (students.length > 0) {
      await tx.courseMembership.createMany({
        data: students.map((s) => ({
          courseId: created.id,
          userId: s.id,
          role: CourseRole.STUDENT,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return ok({ course }, { status: 201 });
});
