// Döküman 8.4: Değerlendirme kuralları — saf fonksiyon (unit test edilebilir).
//  - Her kriter için tek cevap
//  - Sayısal kriterde puan min/max aralığında
//  - Kesin gönderimde tüm zorunlu kriterler dolu

import { CriterionType } from "@/lib/generated/prisma/enums";

export type CriterionShape = {
  id: string;
  title: string;
  type: CriterionType;
  required: boolean;
  minScore: number | null;
  maxScore: number | null;
};

export type AnswerInput = {
  criterionId: string;
  score?: number | null;
  textValue?: string | null;
};

export type NormalizedAnswer = {
  criterionId: string;
  score: number | null;
  textValue: string | null;
};

export type AnswerValidationResult =
  | { valid: true; answers: NormalizedAnswer[] }
  | { valid: false; errors: string[] };

export function validateReviewAnswers(params: {
  criteria: CriterionShape[];
  answers: AnswerInput[];
  final: boolean; // true: kesin gönderim (FR-7.8), false: taslak (FR-7.7)
}): AnswerValidationResult {
  const errors: string[] = [];
  const criterionById = new Map(params.criteria.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const normalized: NormalizedAnswer[] = [];

  for (const answer of params.answers) {
    const criterion = criterionById.get(answer.criterionId);
    if (!criterion) {
      errors.push("Rubrikte olmayan bir kritere cevap gönderildi.");
      continue;
    }
    if (seen.has(criterion.id)) {
      errors.push(`"${criterion.title}" kriterine birden fazla cevap gönderildi.`);
      continue;
    }
    seen.add(criterion.id);

    if (criterion.type === CriterionType.SCORE) {
      const min = criterion.minScore ?? 1;
      const max = criterion.maxScore ?? 10;
      const score = answer.score ?? null;
      if (score === null) {
        if (params.final && criterion.required) {
          errors.push(`"${criterion.title}" için puan verilmelidir.`);
        }
        continue;
      }
      if (!Number.isInteger(score) || score < min || score > max) {
        errors.push(`"${criterion.title}" puanı ${min}-${max} aralığında olmalıdır.`);
        continue;
      }
      normalized.push({ criterionId: criterion.id, score, textValue: null });
    } else {
      const text = answer.textValue?.trim() ?? "";
      if (!text) {
        if (params.final && criterion.required) {
          errors.push(`"${criterion.title}" alanı doldurulmalıdır.`);
        }
        continue;
      }
      normalized.push({ criterionId: criterion.id, score: null, textValue: text });
    }
  }

  if (params.final) {
    for (const criterion of params.criteria) {
      if (!criterion.required) continue;
      const answered = normalized.some((a) => a.criterionId === criterion.id);
      if (!answered && !errors.some((e) => e.includes(`"${criterion.title}"`))) {
        errors.push(`"${criterion.title}" zorunludur ve doldurulmamış.`);
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, answers: normalized };
}
