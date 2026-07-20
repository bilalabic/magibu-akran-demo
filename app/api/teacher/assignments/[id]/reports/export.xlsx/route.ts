import { NextResponse } from "next/server";

import { requireTeacher } from "@/lib/auth/authorization";
import { errorToResponse } from "@/lib/errors";
import { buildAssignmentReport } from "@/lib/reports/aggregate";
import { toExcelBuffer } from "@/lib/reports/excel";
import { buildExportTable, exportFileName } from "@/lib/reports/export-rows";

type Ctx = { params: Promise<{ id: string }> };

// FR-9.7: Excel dışa aktarma.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireTeacher();
    const { id } = await params;

    const report = await buildAssignmentReport(id);
    const { headers, rows } = buildExportTable(report);
    const buffer = await toExcelBuffer(headers, rows);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFileName(report.assignment.title, "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
