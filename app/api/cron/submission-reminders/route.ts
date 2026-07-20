import { verifyCronRequest } from "@/lib/cron/auth";
import { ok, withErrorHandling } from "@/lib/errors";
import { triggerScheduledJob } from "@/server/jobs/trigger-scheduled-job";

export const GET = withErrorHandling(async (req) => {
  await verifyCronRequest(req, "/api/cron/submission-reminders");
  const result = await triggerScheduledJob("submission-reminders");
  return ok(result, result.queued ? { status: 202 } : undefined);
});
