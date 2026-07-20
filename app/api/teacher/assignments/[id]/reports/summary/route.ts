import { requireTeacher } from "@/lib/auth/authorization";
import { ok, withErrorHandling } from "@/lib/errors";
import { buildAssignmentReport } from "@/lib/reports/aggregate";

type Params = { id: string };

// FR-9.1..9.5: Ödev bazlı özet rapor (teslimler, eksik/tamam değerlendirmeler,
// kriter ve genel ortalamalar, metin geri bildirimleri).
export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const report = await buildAssignmentReport(id);
  return ok({ report });
});
