import { describe, expect, it } from "vitest";

import { CriterionType } from "@/lib/generated/prisma/enums";
import { average, overallFromCriterionAverages, round2 } from "@/lib/reports/math";

// Döküman 21.1: Ortalama hesaplama
describe("average", () => {
  it("boş listede null döner", () => {
    expect(average([])).toBeNull();
  });

  it("ortalama hesaplar", () => {
    expect(average([7, 9])).toBe(8);
    expect(average([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("round2", () => {
  it("iki ondalığa yuvarlar", () => {
    expect(round2(8.666666)).toBe(8.67);
    expect(round2(null)).toBeNull();
  });
});

describe("overallFromCriterionAverages", () => {
  const scoreCriterion = (id: string, weight: number | null = null) => ({
    id,
    type: CriterionType.SCORE,
    weight,
  });
  const textCriterion = (id: string) => ({
    id,
    type: CriterionType.TEXT,
    weight: null,
  });

  it("eşit ağırlıkla kriter ortalamalarının ortalamasını alır", () => {
    const result = overallFromCriterionAverages(
      [scoreCriterion("c1"), scoreCriterion("c2")],
      { c1: 8, c2: 6 },
    );
    expect(result).toBe(7);
  });

  it("metin kriterlerini hesaba katmaz", () => {
    const result = overallFromCriterionAverages(
      [scoreCriterion("c1"), textCriterion("t1")],
      { c1: 9, t1: null },
    );
    expect(result).toBe(9);
  });

  it("weight değerlerini uygular", () => {
    const result = overallFromCriterionAverages(
      [scoreCriterion("c1", 3), scoreCriterion("c2", 1)],
      { c1: 10, c2: 6 },
    );
    expect(result).toBe(9); // (10*3 + 6*1) / 4
  });

  it("hiç puan yoksa null döner", () => {
    expect(
      overallFromCriterionAverages([scoreCriterion("c1")], { c1: null }),
    ).toBeNull();
  });
});
