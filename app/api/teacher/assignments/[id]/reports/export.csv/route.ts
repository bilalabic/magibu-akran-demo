import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth/authorization";
import { errorToResponse } from "@/lib/errors";
import { buildAssignmentReport } from "@/lib/reports/aggregate";
import { toCsv } from "@/lib/reports/csv";
import { buildExportTable, exportFileName } from "@/lib/reports/export-rows";

type Ctx = { params: Promise<{ id: string }> };

// FR-9.6: CSV dışa aktarma.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireTeacher();
    const { id } = await params;

    const report = await buildAssignmentReport(id);
    const { headers, rows } = buildExportTable(report);
    const csv = toCsv(headers, rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(report.assignment.title, "csv")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
