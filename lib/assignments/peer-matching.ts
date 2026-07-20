// Döküman Bölüm 16: Akran eşleştirme algoritması — SAF fonksiyon (DB erişimi yok,
// unit test edilebilir). Kurallar:
//  - Yalnızca teslim yapmış öğrenciler değerlendirici olur (FR-6.1)
//  - Kimseye kendi teslimi atanmaz (FR-6.3)
//  - Aynı değerlendiriciye aynı teslim iki kez atanmaz (FR-6.4)
//  - Dağılım dengeli: en az değerlendirme almış teslim önceliklidir (FR-6.5/6.6)
//  - Mevcut atamalar tanınır; yeniden çalıştırma mükerrer üretmez (FR-6.9)
// Özel durumlar: 1 teslim → eşleştirme yok; 2 teslim → herkese 1 görev;
// 3+ teslim → hedef min(requiredReviewCount, teslimSayısı - 1).

export type MatchingSubmission = {
  id: string;
  studentId: string;
};

export type ExistingPeerAssignment = {
  reviewerId: string;
  submissionId: string;
};

export type MatchingWarning =
  | { type: "INSUFFICIENT_SUBMISSIONS"; submissionCount: number }
  | { type: "REDUCED_TARGET"; target: number; requested: number }
  | { type: "PARTIAL_ASSIGNMENT"; reviewerId: string; assigned: number; target: number };

export type MatchingResult = {
  // Yalnızca YENİ oluşturulacak atamalar (mevcutlar hariç)
  newAssignments: Array<{ reviewerId: string; submissionId: string }>;
  targetPerReviewer: number;
  warnings: MatchingWarning[];
};

export function matchPeers(params: {
  submissions: MatchingSubmission[];
  requiredReviewCount: number;
  existing?: ExistingPeerAssignment[];
}): MatchingResult {
  const { submissions, requiredReviewCount } = params;
  const existing = params.existing ?? [];
  const warnings: MatchingWarning[] = [];

  if (submissions.length < 2) {
    return {
      newAssignments: [],
      targetPerReviewer: 0,
      warnings: [{ type: "INSUFFICIENT_SUBMISSIONS", submissionCount: submissions.length }],
    };
  }

  const target = Math.min(requiredReviewCount, submissions.length - 1);
  if (target < requiredReviewCount) {
    warnings.push({ type: "REDUCED_TARGET", target, requested: requiredReviewCount });
  }

  // Determinizm için sıralı kopyalar (test edilebilirlik + tekrarlanabilirlik)
  const orderedSubmissions = [...submissions].sort((a, b) => a.id.localeCompare(b.id));
  const reviewers = orderedSubmissions.map((s) => s.studentId).sort((a, b) => a.localeCompare(b));

  const pairKey = (reviewerId: string, submissionId: string) => `${reviewerId}::${submissionId}`;
  const assignedPairs = new Set(existing.map((e) => pairKey(e.reviewerId, e.submissionId)));

  const reviewerCounts = new Map<string, number>(reviewers.map((r) => [r, 0]));
  const receivedCounts = new Map<string, number>(orderedSubmissions.map((s) => [s.id, 0]));
  for (const e of existing) {
    if (reviewerCounts.has(e.reviewerId)) {
      reviewerCounts.set(e.reviewerId, (reviewerCounts.get(e.reviewerId) ?? 0) + 1);
    }
    if (receivedCounts.has(e.submissionId)) {
      receivedCounts.set(e.submissionId, (receivedCounts.get(e.submissionId) ?? 0) + 1);
    }
  }

  const newAssignments: Array<{ reviewerId: string; submissionId: string }> = [];

  // Round-robin: her turda her değerlendiriciye en fazla bir görev verilir;
  // böylece teslimlerin aldığı değerlendirme sayıları dengeli büyür.
  for (let round = 0; round < target; round++) {
    for (const reviewerId of reviewers) {
      if ((reviewerCounts.get(reviewerId) ?? 0) >= target) continue;

      const candidates = orderedSubmissions.filter(
        (submission) =>
          submission.studentId !== reviewerId &&
          !assignedPairs.has(pairKey(reviewerId, submission.id)),
      );
      if (candidates.length === 0) continue;

      // En az değerlendirme almış teslim; eşitlikte deterministik (id) sıra
      candidates.sort((a, b) => {
        const diff = (receivedCounts.get(a.id) ?? 0) - (receivedCounts.get(b.id) ?? 0);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });

      const chosen = candidates[0]!;
      assignedPairs.add(pairKey(reviewerId, chosen.id));
      reviewerCounts.set(reviewerId, (reviewerCounts.get(reviewerId) ?? 0) + 1);
      receivedCounts.set(chosen.id, (receivedCounts.get(chosen.id) ?? 0) + 1);
      newAssignments.push({ reviewerId, submissionId: chosen.id });
    }
  }

  for (const reviewerId of reviewers) {
    const assigned = reviewerCounts.get(reviewerId) ?? 0;
    if (assigned < target) {
      warnings.push({ type: "PARTIAL_ASSIGNMENT", reviewerId, assigned, target });
    }
  }

  return { newAssignments, targetPerReviewer: target, warnings };
}
