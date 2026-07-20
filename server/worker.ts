import "dotenv/config";

import { prisma } from "@/lib/db/prisma";
import { closeMailer } from "@/lib/email/mailer";
import { processEmailJob, type EmailJobPayload } from "@/lib/email/process";
import { getBoss, stopBoss } from "@/lib/jobs/boss";
import {
  JOB_QUEUES,
  QUEUE_BY_SCHEDULED_JOB,
  SCHEDULED_JOBS,
} from "@/lib/jobs/queues";
import { runScheduledJob } from "@/server/jobs/scheduled-jobs";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const emailConcurrency = positiveInt(process.env.EMAIL_WORKER_CONCURRENCY, 5);
const timezone = process.env.TZ ?? "Europe/Istanbul";
let stopping = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal} alındı; işler güvenli biçimde durduruluyor.`);
  try {
    await stopBoss(25_000);
    closeMailer();
    await prisma.$disconnect();
  } catch (error) {
    console.error("[worker] kapatma hatası:", error);
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

async function registerWorkers() {
  const boss = await getBoss("worker");

  await boss.work<EmailJobPayload>(
    JOB_QUEUES.email,
    {
      localConcurrency: emailConcurrency,
      pollingIntervalSeconds: 1,
      orderByCreatedOn: false,
    },
    async ([job]) => {
      if (!job) return;
      const result = await processEmailJob(job.data);
      if (result === "FAILED") {
        throw new Error(`E-posta gönderilemedi: ${job.data.jobKey}`);
      }
      return { result, jobKey: job.data.jobKey };
    },
  );

  for (const schedule of SCHEDULED_JOBS) {
    const name = schedule.name;
    await boss.work(
      QUEUE_BY_SCHEDULED_JOB[name],
      { localConcurrency: 1, pollingIntervalSeconds: 1 },
      async () => runScheduledJob(name),
    );
  }

  if (process.env.JOB_SCHEDULER_ENABLED !== "false") {
    for (const schedule of SCHEDULED_JOBS) {
      await boss.schedule(
        QUEUE_BY_SCHEDULED_JOB[schedule.name],
        schedule.cron,
        { scheduledBy: "magibudemo-worker" },
        { tz: timezone, key: "primary" },
      );
    }
  }

  console.log(
    `[worker] hazır; emailConcurrency=${emailConcurrency}, timezone=${timezone}, scheduler=${
      process.env.JOB_SCHEDULER_ENABLED !== "false"
    }`,
  );
  return boss;
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("[worker] yakalanmamış promise hatası:", error);
  void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  console.error("[worker] yakalanmamış hata:", error);
  void shutdown("uncaughtException", 1);
});

void registerWorkers().catch((error) => {
  console.error("[worker] başlatılamadı:", error);
  void shutdown("startup-error", 1);
});
