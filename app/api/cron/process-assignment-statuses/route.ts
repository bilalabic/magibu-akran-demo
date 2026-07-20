import { verifyCronRequest } from "@/lib/cron/auth";
import { ok, withErrorHandling } from "@/lib/errors";
import { triggerScheduledJob } from "@/server/jobs/trigger-scheduled-job";

// Coolify/pg-boss modunda yalnızca kalıcı kuyruğa iş bırakır. QStash'in pasif
// Vercel uyumluluk modunda eski davranış korunur ve iş bu istekte çalışır.
export const GET = withErrorHandling(async (req) => {
  await verifyCronRequest(req, "/api/cron/process-assignment-statuses");
  const result = await triggerScheduledJob("process-assignment-statuses");
  return ok(result, result.queued ? { status: 202 } : undefined);
});
