import { CriterionType } from "@/lib/generated/prisma/enums";
import type { AssignmentReport } from "@/lib/reports/aggregate";
import { formatDateTimeTr } from "@/lib/utils/date";

// Döküman Bölüm 18 kolonları. Satır düzeni: öğrenci × sayısal kriter.
// "Başarılı Noktalar" ve "Geliştirilmesi Gereken Alanlar" varsayılan rubrikteki
// metin kriterlerinden gelir; ek metin kriterleri sona ayrı kolon olarak eklenir.

const SUBMISSION_STATUS_TR: Record<string, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Teslim Edildi",
  LOCKED: "Kilitli",
};

export function buildExportTable(report: AssignmentReport): {
  headers: string[];
  rows: Array<Array<string | number | null>>;
} {
  const scoreCriteria = report.criteria.filter((c) => c.type === CriterionType.SCORE);
  const textCriteria = report.criteria.filter((c) => c.type === CriterionType.TEXT);

  const successCriterion =
    textCriteria.find((c) => c.title.toLocaleLowerCase("tr").includes("başarılı")) ?? null;
  const improveCriterion =
    textCriteria.find((c) => c.title.toLocaleLowerCase("tr").includes("geliştiril")) ?? null;
  const extraTextCriteria = textCriteria.filter(
    (c) => c.id !== successCriterion?.id && c.id !== improveCriterion?.id,
  );

  const headers = [
    "Ders",
    "Modül",
    "Ödev",
    "Öğrenci Adı",
    "Öğrenci E-postası",
    "Teslim Başlığı",
    "Teslim Durumu",
    "Teslim Tarihi",
    "Bağlantılar",
    "Atanan Değerlendirme Sayısı",
    "Tamamlanan Değerlendirme Sayısı",
    "Kriter Adı",
    "Puan",
    "Kriter Ortalaması",
    "Genel Ortalama",
    "Başarılı Noktalar",
    "Geliştirilmesi Gereken Alanlar",
    ...extraTextCriteria.map((c) => c.title),
  ];

  const rows: Array<Array<string | number | null>> = [];

  for (const row of report.rows) {
    const base: Array<string | number | null> = [
      report.courseName,
      report.moduleTitle ?? "",
      report.assignment.title,
      row.student.name,
      row.student.email,
      row.submission?.title ?? "Teslim yok",
      row.submission ? (SUBMISSION_STATUS_TR[row.submission.status] ?? row.submission.status) : "Teslim yok",
      row.submission?.submittedAt ? formatDateTimeTr(row.submission.submittedAt) : "",
      row.submission?.links.map((l) => (l.label ? `${l.label}: ${l.url}` : l.url)).join(" | ") ??
        "",
      row.assignedReviewCount,
      row.completedReviewCount,
    ];

    const successTexts = successCriterion
      ? (row.textsByCriterion[successCriterion.id] ?? []).join(" | ")
      : "";
    const improveTexts = improveCriterion
      ? (row.textsByCriterion[improveCriterion.id] ?? []).join(" | ")
      : "";
    const extraTexts = extraTextCriteria.map((c) =>
      (row.textsByCriterion[c.id] ?? []).join(" | "),
    );

    if (scoreCriteria.length === 0) {
      rows.push([
        ...base,
        "",
        "",
        "",
        row.overallAverage,
        successTexts,
        improveTexts,
        ...extraTexts,
      ]);
      continue;
    }

    scoreCriteria.forEach((criterion, index) => {
      rows.push([
        ...base,
        criterion.title,
        (row.scoresByCriterion[criterion.id] ?? []).join(", "),
        row.averageByCriterion[criterion.id],
        row.overallAverage,
        // Metin kolonları yalnızca ilk satırda tekrarlanır (okunabilirlik)
        index === 0 ? successTexts : "",
        index === 0 ? improveTexts : "",
        ...extraTexts.map((text) => (index === 0 ? text : "")),
      ]);
    });
  }

  return { headers, rows };
}

export function exportFileName(assignmentTitle: string, extension: "csv" | "xlsx"): string {
  const slug = assignmentTitle
    .toLocaleLowerCase("tr")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `akran-rapor-${slug || "odev"}.${extension}`;
}
