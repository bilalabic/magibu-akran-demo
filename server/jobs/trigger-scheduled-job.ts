import "server-only";

import { enqueueScheduledJob } from "@/lib/jobs/boss";
import { usesDurableWorker } from "@/lib/jobs/qstash";
import type { ScheduledJobName } from "@/lib/jobs/queues";
import { runScheduledJob } from "@/server/jobs/scheduled-jobs";

export async function triggerScheduledJob(name: ScheduledJobName) {
  if (usesDurableWorker()) {
    const jobId = await enqueueScheduledJob(name);
    return { queued: Boolean(jobId), jobId, result: null };
  }

  const result = await runScheduledJob(name);
  return { queued: false, jobId: null, result };
}
