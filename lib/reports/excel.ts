import "server-only";

import ExcelJS from "exceljs";

// FR-9.7: Excel dışa aktarma (exceljs).
export async function toExcelBuffer(
  headers: string[],
  rows: Array<Array<string | number | null>>,
  sheetName = "Rapor",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Akran Değerlendirme Sistemi";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = headers.map((header) => ({
    header,
    width: Math.min(Math.max(header.length + 4, 14), 50),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow(row.map((value) => (value === null ? "" : value)));
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
