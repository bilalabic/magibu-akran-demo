// Rapor hesaplama saf fonksiyonları (unit test edilebilir; DB bağımlılığı yok).
import { CriterionType } from "@/lib/generated/prisma/enums";

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

// Kriter ortalamalarından genel ortalama (weight yoksa eşit ağırlık).
export function overallFromCriterionAverages(
  criteria: Array<{ id: string; type: CriterionType; weight: number | null }>,
  averageByCriterion: Record<string, number | null>,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const criterion of criteria) {
    if (criterion.type !== CriterionType.SCORE) continue;
    const avg = averageByCriterion[criterion.id];
    if (avg === null || avg === undefined) continue;
    const weight = criterion.weight ?? 1;
    weightedSum += avg * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
