import { AssignmentStatus } from "@/lib/generated/prisma/enums";

// FR-3.6: Ödev durumları tarihlere göre sistem tarafından güncellenir.
// DRAFT, COMPLETED ve ARCHIVED yalnızca öğretmen aksiyonuyla değişir; aradaki
// durumlar tarih bazlı akar. Geçişler yalnızca ileri yönlüdür.

const ORDER: AssignmentStatus[] = [
  AssignmentStatus.DRAFT,
  AssignmentStatus.PUBLISHED,
  AssignmentStatus.SUBMISSION_OPEN,
  AssignmentStatus.SUBMISSION_CLOSED,
  AssignmentStatus.REVIEW_OPEN,
  AssignmentStatus.REVIEW_CLOSED,
  AssignmentStatus.COMPLETED,
  AssignmentStatus.ARCHIVED,
];

export function statusRank(status: AssignmentStatus): number {
  return ORDER.indexOf(status);
}

export function isAtOrAfter(status: AssignmentStatus, reference: AssignmentStatus): boolean {
  return statusRank(status) >= statusRank(reference);
}

export type AssignmentDates = {
  submissionStartsAt: Date;
  submissionEndsAt: Date;
  reviewStartsAt: Date;
  reviewEndsAt: Date;
};

// Yayınlanmış bir ödevin tarihlere göre olması gereken durumu.
// DRAFT / COMPLETED / ARCHIVED durumundaki ödevlere dokunmaz (null döner).
export function expectedStatusByDates(
  current: AssignmentStatus,
  dates: AssignmentDates,
  now: Date,
): AssignmentStatus | null {
  if (
    current === AssignmentStatus.DRAFT ||
    current === AssignmentStatus.COMPLETED ||
    current === AssignmentStatus.ARCHIVED
  ) {
    return null;
  }

  let expected: AssignmentStatus;
  if (now < dates.submissionStartsAt) {
    expected = AssignmentStatus.PUBLISHED;
  } else if (now < dates.submissionEndsAt) {
    expected = AssignmentStatus.SUBMISSION_OPEN;
  } else if (now < dates.reviewStartsAt) {
    expected = AssignmentStatus.SUBMISSION_CLOSED;
  } else if (now < dates.reviewEndsAt) {
    expected = AssignmentStatus.REVIEW_OPEN;
  } else {
    expected = AssignmentStatus.REVIEW_CLOSED;
  }

  // Yalnızca ileri geçiş: mevcut durum zaten ilerideyse dokunma.
  if (statusRank(expected) <= statusRank(current)) return null;
  return expected;
}

// Teslim penceresi açık mı? (FR-4.9/4.10 için)
export function isSubmissionWindowOpen(
  status: AssignmentStatus,
  dates: AssignmentDates,
  now: Date,
): boolean {
  if (status !== AssignmentStatus.SUBMISSION_OPEN && status !== AssignmentStatus.PUBLISHED) {
    return false;
  }
  return now >= dates.submissionStartsAt && now < dates.submissionEndsAt;
}

// Değerlendirme penceresi açık mı? (FR-7 için)
export function isReviewWindowOpen(
  status: AssignmentStatus,
  dates: AssignmentDates,
  now: Date,
): boolean {
  if (status !== AssignmentStatus.REVIEW_OPEN) return false;
  return now >= dates.reviewStartsAt && now < dates.reviewEndsAt;
}
