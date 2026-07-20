import "server-only";

import type { AuthUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import type { Assignment } from "@/lib/generated/prisma/client";
import { AssignmentStatus, UserRole } from "@/lib/generated/prisma/enums";

export async function getAssignmentOrThrow(id: string): Promise<Assignment> {
  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    throw new ApiError("NOT_FOUND", "Ödev bulunamadı.");
  }
  return assignment;
}

// Öğrenci: derse üyelik + ödevin yayınlanmış olması gerekir.
// Öğretmen: her ödeve erişir.
export async function assertCanViewAssignment(
  user: AuthUser,
  assignment: Assignment,
): Promise<void> {
  if (user.role === UserRole.TEACHER) return;

  if (assignment.status === AssignmentStatus.DRAFT) {
    throw new ApiError("NOT_FOUND", "Ödev bulunamadı.");
  }
  const membership = await prisma.courseMembership.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: assignment.courseId } },
  });
  if (!membership || membership.leftAt !== null) {
    throw new ApiError("FORBIDDEN", "Bu ödeve erişiminiz yok.");
  }
}
