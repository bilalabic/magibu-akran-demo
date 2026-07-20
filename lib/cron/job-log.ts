import "server-only";

import { prisma } from "@/lib/db/prisma";

// Her cron çalışması ScheduledJobLog'a yazılır (izlenebilirlik).
export async function withJobLog<T>(
  jobType: string,
  fn: () => Promise<T>,
): Promise<T> {
  const jobKey = `${jobType}:${new Date().toISOString()}`;
  const log = await prisma.scheduledJobLog.create({
    data: { jobKey, jobType, status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await fn();
    await prisma.scheduledJobLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        result: result === undefined ? undefined : (result as object),
      },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await prisma.scheduledJobLog.update({
      where: { id: log.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 500) },
    });
    throw error;
  }
}
