// FR-9.6: CSV dışa aktarma. Harici kütüphane gerekmez; RFC 4180 kaçışları
// uygulanır. Türkçe karakterler için UTF-8 BOM eklenir (Excel uyumu).

// CSV formül enjeksiyonu (CWE-1236) koruması: öğrenci kaynaklı metinler (ad,
// teslim başlığı, bağlantı etiketi, değerlendirme cevapları) rapora girer.
// Excel/LibreOffice, `=`, `+`, `-`, `@`, tab veya CR ile başlayan hücreyi
// formül olarak yürütür; bu karakterlerle başlayan değerleri tek tırnakla
// nötrleştiriyoruz.
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function neutralizeFormula(text: string): string {
  return text.length > 0 && FORMULA_TRIGGERS.has(text[0]!) ? `'${text}` : text;
}

function escapeCsvValue(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const text = neutralizeFormula(String(value));
  if (/[",\r\n;]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null>>,
): string {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];
  return "﻿" + lines.join("\r\n");
}
