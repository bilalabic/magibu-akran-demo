import { describe, expect, it } from "vitest";

import { CriterionType } from "@/lib/generated/prisma/enums";
import {
  validateReviewAnswers,
  type CriterionShape,
} from "@/lib/reviews/validate-answers";

// Döküman 8.4: değerlendirme kuralları
const criteria: CriterionShape[] = [
  {
    id: "score-1",
    title: "İçerik",
    type: CriterionType.SCORE,
    required: true,
    minScore: 1,
    maxScore: 10,
  },
  {
    id: "text-1",
    title: "Başarılı Noktalar",
    type: CriterionType.TEXT,
    required: true,
    minScore: null,
    maxScore: null,
  },
  {
    id: "text-2",
    title: "Ek Not",
    type: CriterionType.TEXT,
    required: false,
    minScore: null,
    maxScore: null,
  },
];

describe("validateReviewAnswers — taslak (final=false)", () => {
  it("kısmi cevapları kabul eder (FR-7.7)", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [{ criterionId: "score-1", score: 7 }],
      final: false,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.answers).toEqual([
        { criterionId: "score-1", score: 7, textValue: null },
      ]);
    }
  });

  it("aralık dışı puanı taslakta bile reddeder", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [{ criterionId: "score-1", score: 11 }],
      final: false,
    });
    expect(result.valid).toBe(false);
  });

  it("rubrikte olmayan kriteri reddeder", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [{ criterionId: "sahte", score: 5 }],
      final: false,
    });
    expect(result.valid).toBe(false);
  });

  it("aynı kritere çift cevabı reddeder", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [
        { criterionId: "score-1", score: 5 },
        { criterionId: "score-1", score: 7 },
      ],
      final: false,
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateReviewAnswers — kesin gönderim (final=true)", () => {
  it("tüm zorunlu kriterler doluysa kabul eder (FR-7.8)", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [
        { criterionId: "score-1", score: 9 },
        { criterionId: "text-1", textValue: "Kod düzeni çok iyi." },
      ],
      final: true,
    });
    expect(result.valid).toBe(true);
  });

  it("eksik zorunlu sayısal kriteri reddeder", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [{ criterionId: "text-1", textValue: "Güzel." }],
      final: true,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join(" ")).toContain("İçerik");
    }
  });

  it("eksik zorunlu metin kriterini reddeder", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [{ criterionId: "score-1", score: 8 }],
      final: true,
    });
    expect(result.valid).toBe(false);
  });

  it("boş metin zorunlu kriteri karşılamaz", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [
        { criterionId: "score-1", score: 8 },
        { criterionId: "text-1", textValue: "   " },
      ],
      final: true,
    });
    expect(result.valid).toBe(false);
  });

  it("opsiyonel kriter boş bırakılabilir", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [
        { criterionId: "score-1", score: 8 },
        { criterionId: "text-1", textValue: "Harika." },
      ],
      final: true,
    });
    expect(result.valid).toBe(true);
  });

  it("min sınırın altındaki puanı reddeder", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [
        { criterionId: "score-1", score: 0 },
        { criterionId: "text-1", textValue: "x" },
      ],
      final: true,
    });
    expect(result.valid).toBe(false);
  });

  it("ondalıklı puanı reddeder (tam sayı kuralı)", () => {
    const result = validateReviewAnswers({
      criteria,
      answers: [
        { criterionId: "score-1", score: 7.5 },
        { criterionId: "text-1", textValue: "x" },
      ],
      final: true,
    });
    expect(result.valid).toBe(false);
  });
});
