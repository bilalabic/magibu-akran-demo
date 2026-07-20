import "server-only";

import type { AuthUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import { PeerAssignmentStatus, UserRole } from "@/lib/generated/prisma/enums";

export async function getPeerAssignmentOrThrow(id: string) {
  const peerAssignment = await prisma.peerAssignment.findUnique({
    where: { id },
    include: {
      assignment: true,
      submission: { include: { links: { orderBy: { sortOrder: "asc" } } } },
      review: { include: { answers: true } },
    },
  });
  if (!peerAssignment) {
    throw new ApiError("NOT_FOUND", "Değerlendirme görevi bulunamadı.");
  }
  return peerAssignment;
}

// FR-7.6: Öğrenci yalnızca kendisine atanmış teslimleri değerlendirir.
export function assertReviewerOrTeacher(
  user: AuthUser,
  peerAssignment: { reviewerId: string },
): void {
  if (user.role === UserRole.TEACHER) return;
  if (peerAssignment.reviewerId !== user.id) {
    throw new ApiError("FORBIDDEN", "Bu değerlendirme görevi size ait değil.");
  }
}

export function assertReviewWindowOpen(peerAssignment: {
  status: PeerAssignmentStatus;
  expiresAt: Date;
  assignment: { reviewEndsAt: Date };
}): void {
  if (peerAssignment.status === PeerAssignmentStatus.EXPIRED) {
    throw new ApiError("BUSINESS_RULE", "Bu değerlendirme görevinin süresi dolmuş.");
  }
  const deadline = peerAssignment.assignment.reviewEndsAt;
  if (new Date() >= deadline) {
    throw new ApiError("BUSINESS_RULE", "Değerlendirme süresi sona erdi.");
  }
}

// FR-7.10: Teslim sahibinin kimliği değerlendiriciye, değerlendiricinin kimliği
// de teslim sahibine gösterilmez. Öğrenciye dönen serializasyonda kimlik yok.
export function serializePeerAssignmentForStudent(peerAssignment: {
  id: string;
  status: PeerAssignmentStatus;
  assignedAt: Date;
  expiresAt: Date;
  assignment: {
    id: string;
    title: string;
    reviewStartsAt: Date;
    reviewEndsAt: Date;
    status: string;
  };
  submission: {
    id: string;
    title: string;
    description: string;
    submittedAt: Date | null;
    links: Array<{ id: string; label: string | null; url: string; sortOrder: number }>;
  };
  review: {
    id: string;
    status: string;
    submittedAt: Date | null;
    answers: Array<{ criterionId: string; score: number | null; textValue: string | null }>;
  } | null;
}) {
  return {
    id: peerAssignment.id,
    status: peerAssignment.status,
    assignedAt: peerAssignment.assignedAt,
    expiresAt: peerAssignment.expiresAt,
    assignment: {
      id: peerAssignment.assignment.id,
      title: peerAssignment.assignment.title,
      reviewStartsAt: peerAssignment.assignment.reviewStartsAt,
      reviewEndsAt: peerAssignment.assignment.reviewEndsAt,
      status: peerAssignment.assignment.status,
    },
    submission: {
      id: peerAssignment.submission.id,
      title: peerAssignment.submission.title,
      description: peerAssignment.submission.description,
      submittedAt: peerAssignment.submission.submittedAt,
      links: peerAssignment.submission.links.map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
        sortOrder: link.sortOrder,
      })),
    },
    review: peerAssignment.review
      ? {
          id: peerAssignment.review.id,
          status: peerAssignment.review.status,
          submittedAt: peerAssignment.review.submittedAt,
          answers: peerAssignment.review.answers.map((a) => ({
            criterionId: a.criterionId,
            score: a.score,
            textValue: a.textValue,
          })),
        }
      : null,
  };
}
