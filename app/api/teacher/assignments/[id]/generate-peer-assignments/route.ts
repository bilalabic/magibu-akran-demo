import { requireTeacher } from "@/lib/auth/authorization";
import { ok, withErrorHandling } from "@/lib/errors";
import { generatePeerAssignments } from "@/server/services/peer-assignment-service";

type Params = { id: string };

// FR-6: Akran atamalarını başlat (idempotent — tekrar çalıştırılabilir).
export const POST = withErrorHandling<Params>(async (_req, { params }) => {
  await requireTeacher();
  const { id } = await params;

  const result = await generatePeerAssignments(id);
  return ok(result);
});
