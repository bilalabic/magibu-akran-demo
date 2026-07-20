import { describe, expect, it } from "vitest";

import {
  matchPeers,
  type MatchingSubmission,
} from "@/lib/assignments/peer-matching";

// Döküman Bölüm 16 + FR-6: akran eşleştirme algoritması senaryoları.

function submissionsFor(count: number): MatchingSubmission[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sub-${i + 1}`,
    studentId: `student-${i + 1}`,
  }));
}

function receivedCounts(assignments: Array<{ submissionId: string }>) {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    counts.set(a.submissionId, (counts.get(a.submissionId) ?? 0) + 1);
  }
  return counts;
}

function reviewerCounts(assignments: Array<{ reviewerId: string }>) {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    counts.set(a.reviewerId, (counts.get(a.reviewerId) ?? 0) + 1);
  }
  return counts;
}

describe("matchPeers — özel durumlar (döküman 16)", () => {
  it("0 teslim: eşleştirme yapılamaz", () => {
    const result = matchPeers({ submissions: [], requiredReviewCount: 2 });
    expect(result.newAssignments).toHaveLength(0);
    expect(result.warnings[0]).toMatchObject({ type: "INSUFFICIENT_SUBMISSIONS" });
  });

  it("1 teslim: akran değerlendirme yapılamaz", () => {
    const result = matchPeers({ submissions: submissionsFor(1), requiredReviewCount: 2 });
    expect(result.newAssignments).toHaveLength(0);
    expect(result.warnings[0]).toMatchObject({
      type: "INSUFFICIENT_SUBMISSIONS",
      submissionCount: 1,
    });
  });

  it("2 teslim: her öğrenci yalnızca diğerinin teslimini alır (1'er görev)", () => {
    const result = matchPeers({ submissions: submissionsFor(2), requiredReviewCount: 2 });
    expect(result.targetPerReviewer).toBe(1);
    expect(result.newAssignments).toHaveLength(2);
    expect(result.warnings).toContainEqual({
      type: "REDUCED_TARGET",
      target: 1,
      requested: 2,
    });
    // Kendine atama yok (FR-6.3)
    for (const a of result.newAssignments) {
      const submission = submissionsFor(2).find((s) => s.id === a.submissionId)!;
      expect(submission.studentId).not.toBe(a.reviewerId);
    }
  });

  it("3 teslim: her öğrenci diğer iki teslimi değerlendirir", () => {
    const result = matchPeers({ submissions: submissionsFor(3), requiredReviewCount: 2 });
    expect(result.targetPerReviewer).toBe(2);
    expect(result.newAssignments).toHaveLength(6);
    const perReviewer = reviewerCounts(result.newAssignments);
    for (const count of perReviewer.values()) expect(count).toBe(2);
    const perSubmission = receivedCounts(result.newAssignments);
    for (const count of perSubmission.values()) expect(count).toBe(2);
  });

  it("5 teslim: dengeli dağılım — herkes 2 görev, her teslim 2 değerlendirme", () => {
    const result = matchPeers({ submissions: submissionsFor(5), requiredReviewCount: 2 });
    expect(result.newAssignments).toHaveLength(10);
    const perReviewer = reviewerCounts(result.newAssignments);
    for (const count of perReviewer.values()) expect(count).toBe(2);
    const perSubmission = receivedCounts(result.newAssignments);
    for (const count of perSubmission.values()) expect(count).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("matchPeers — temel kurallar", () => {
  it("FR-6.3: hiç kimseye kendi teslimi atanmaz (50 öğrenci)", () => {
    const submissions = submissionsFor(50);
    const byId = new Map(submissions.map((s) => [s.id, s]));
    const result = matchPeers({ submissions, requiredReviewCount: 2 });
    for (const a of result.newAssignments) {
      expect(byId.get(a.submissionId)!.studentId).not.toBe(a.reviewerId);
    }
  });

  it("FR-6.4: aynı değerlendiriciye aynı teslim iki kez atanmaz", () => {
    const result = matchPeers({ submissions: submissionsFor(10), requiredReviewCount: 3 });
    const pairs = new Set(
      result.newAssignments.map((a) => `${a.reviewerId}:${a.submissionId}`),
    );
    expect(pairs.size).toBe(result.newAssignments.length);
  });

  it("FR-6.5/6.6: dağılım dengeli — alınan değerlendirme sayıları en fazla 1 fark eder", () => {
    const result = matchPeers({ submissions: submissionsFor(7), requiredReviewCount: 2 });
    const counts = [...receivedCounts(result.newAssignments).values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("deterministiktir (aynı girdi → aynı çıktı)", () => {
    const first = matchPeers({ submissions: submissionsFor(6), requiredReviewCount: 2 });
    const second = matchPeers({ submissions: submissionsFor(6), requiredReviewCount: 2 });
    expect(first.newAssignments).toEqual(second.newAssignments);
  });
});

describe("matchPeers — idempotency (FR-6.9)", () => {
  it("mevcut atamalar verildiğinde mükerrer üretmez", () => {
    const submissions = submissionsFor(4);
    const firstRun = matchPeers({ submissions, requiredReviewCount: 2 });
    expect(firstRun.newAssignments).toHaveLength(8);

    const secondRun = matchPeers({
      submissions,
      requiredReviewCount: 2,
      existing: firstRun.newAssignments,
    });
    expect(secondRun.newAssignments).toHaveLength(0);
  });

  it("kısmi mevcut atamaları tamamlar, tekrar etmez", () => {
    const submissions = submissionsFor(4);
    const full = matchPeers({ submissions, requiredReviewCount: 2 });
    const partial = full.newAssignments.slice(0, 3);

    const completion = matchPeers({
      submissions,
      requiredReviewCount: 2,
      existing: partial,
    });

    const combined = [...partial, ...completion.newAssignments];
    const pairs = new Set(combined.map((a) => `${a.reviewerId}:${a.submissionId}`));
    expect(pairs.size).toBe(combined.length); // mükerrer yok
    const perReviewer = reviewerCounts(combined);
    for (const count of perReviewer.values()) expect(count).toBe(2);
  });

  it("geç teslim eklendiğinde yeni öğrenciye görev üretir, eskileri bozmaz", () => {
    const four = submissionsFor(4);
    const firstRun = matchPeers({ submissions: four, requiredReviewCount: 2 });

    const five = submissionsFor(5);
    const secondRun = matchPeers({
      submissions: five,
      requiredReviewCount: 2,
      existing: firstRun.newAssignments,
    });

    // Yeni öğrenci (student-5) görev almalı
    const newReviewer = secondRun.newAssignments.filter(
      (a) => a.reviewerId === "student-5",
    );
    expect(newReviewer).toHaveLength(2);
    // Eski çiftler tekrar üretilmemeli
    const oldPairs = new Set(
      firstRun.newAssignments.map((a) => `${a.reviewerId}:${a.submissionId}`),
    );
    for (const a of secondRun.newAssignments) {
      expect(oldPairs.has(`${a.reviewerId}:${a.submissionId}`)).toBe(false);
    }
  });
});
