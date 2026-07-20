import "server-only";

import type { AuthUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import type { Assignment, Submission } from "@/lib/generated/prisma/client";
import { SubmissionStatus, UserRole } from "@/lib/generated/prisma/enums";

// Havuz görünürlüğü (kullanıcı kararı, 2026-07-19): öğrenciler ve öğretmen
// havuzu teslim süresi bitmeden de görebilir. Yayınlanmış (DRAFT olmayan)
// ödevin havuzu derse üye herkese açıktır; yalnızca DRAFT teslimler gizlidir.

export async function getSubmissionOrThrow(
  id: string,
): Promise<Submission & { assignment: Assignment }> {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (!submission) {
    throw new ApiError("NOT_FOUND", "Teslim bulunamadı.");
  }
  return submission;
}

// Teslim görüntüleme: öğretmen her zaman; sahibi her zaman; diğer öğrenciler
// derse üyeyse (teslim DRAFT değilse).
export async function assertCanViewSubmission(
  user: AuthUser,
  submission: Submission & { assignment: Assignment },
): Promise<void> {
  if (user.role === UserRole.TEACHER) return;
  if (submission.studentId === user.id) return;

  if (submission.status === SubmissionStatus.DRAFT) {
    throw new ApiError("NOT_FOUND", "Teslim bulunamadı.");
  }

  const membership = await prisma.courseMembership.findUnique({
    where: {
      userId_courseId: { userId: user.id, courseId: submission.assignment.courseId },
    },
  });
  if (!membership || membership.leftAt !== null) {
    throw new ApiError("FORBIDDEN", "Bu teslime erişiminiz yok.");
  }
}
