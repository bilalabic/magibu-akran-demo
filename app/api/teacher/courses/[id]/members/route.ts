import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { normalizeEmail } from "@/lib/utils/email";
import { memberAddSchema } from "@/lib/validation/course";

type Params = { id: string };

export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  const members = await prisma.courseMembership.findMany({
    where: { courseId: id },
    orderBy: { joinedAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, status: true } },
    },
  });

  return ok({ members });
});

export const POST = withErrorHandling<Params>(async (req, { params }) => {
  await requireTeacher();
  const { id } = await params;
  const body = await parseJsonBody(req, memberAddSchema);
  const email = normalizeEmail(body.email);

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    throw new ApiError("NOT_FOUND", "Ders bulunamadı.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(
      "NOT_FOUND",
      "Bu e-posta ile kayıtlı kullanıcı yok. Önce white-list'e ekleyin ve kayıt olmasını bekleyin.",
    );
  }

  const existing = await prisma.courseMembership.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: id } },
  });
  if (existing) {
    if (existing.leftAt === null) {
      throw new ApiError("CONFLICT", "Kullanıcı zaten bu dersin üyesi.");
    }
    const rejoined = await prisma.courseMembership.update({
      where: { id: existing.id },
      data: { leftAt: null, role: body.role },
    });
    return ok({ membership: rejoined });
  }

  const membership = await prisma.courseMembership.create({
    data: { courseId: id, userId: user.id, role: body.role },
  });

  return ok({ membership }, { status: 201 });
});
