import "server-only";

import { Client } from "@upstash/qstash";

import { prisma } from "@/lib/db/prisma";
import { processEmailJob, type EmailJobPayload } from "@/lib/email/process";
import { NotificationStatus } from "@/lib/generated/prisma/enums";
import { enqueuePgBossEmail, enqueuePgBossEmails } from "@/lib/jobs/boss";

// Coolify production varsayılanı PostgreSQL/pg-boss'tur. QStash entegrasyonu
// Vercel'e geri dönüş için pasif olarak korunur; yerel geliştirmede inline
// backend kullanılabilir.

export type JobBackend = "pgboss" | "qstash" | "inline";

export function appUrl(): string {
  const url =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

function qstashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token, baseUrl: process.env.QSTASH_URL || undefined });
}

export function jobBackend(): JobBackend {
  const configured = process.env.JOB_BACKEND?.toLowerCase();
  if (configured === "pgboss" || configured === "qstash" || configured === "inline") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "pgboss" : "inline";
}

export function usesDurableWorker(): boolean {
  return jobBackend() === "pgboss";
}

async function stageEmail(payload: EmailJobPayload): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({
    where: { jobKey: payload.jobKey },
    select: { status: true },
  });
  if (existing?.status === NotificationStatus.SENT) return false;

  await prisma.notificationLog.upsert({
    where: { jobKey: payload.jobKey },
    update: {
      recipientEmail: payload.to,
      recipientUserId: payload.recipientUserId ?? null,
      scheduledFor: new Date(),
      metadata: payload.data as object,
    },
    create: {
      jobKey: payload.jobKey,
      type: payload.type,
      status: NotificationStatus.PENDING,
      recipientEmail: payload.to,
      recipientUserId: payload.recipientUserId ?? null,
      scheduledFor: new Date(),
      metadata: payload.data as object,
    },
  });
  return true;
}

async function markEnqueueFailed(payload: EmailJobPayload): Promise<void> {
  await prisma.notificationLog
    .upsert({
      where: { jobKey: payload.jobKey },
      update: {
        status: NotificationStatus.FAILED,
        failedAt: new Date(),
        errorMessage: "Kuyruğa ekleme hatası",
      },
      create: {
        jobKey: payload.jobKey,
        type: payload.type,
        status: NotificationStatus.FAILED,
        recipientEmail: payload.to,
        recipientUserId: payload.recipientUserId ?? null,
        failedAt: new Date(),
        errorMessage: "Kuyruğa ekleme hatası",
        metadata: payload.data as object,
      },
    })
    .catch(() => undefined);
}

// Üretim request'i yalnızca kalıcı kuyruğa yazılmasını bekler; SMTP gönderimi
// ayrı worker'da yapılır. Hata durumunda NotificationLog recovery işi tarafından
// yeniden kuyruğa alınabilecek şekilde FAILED/attempts=0 bırakılır.
export async function enqueueEmail(payload: EmailJobPayload): Promise<void> {
  try {
    if (!(await stageEmail(payload))) return;

    const backend = jobBackend();
    if (backend === "pgboss") {
      await enqueuePgBossEmail(payload);
      return;
    }

    if (backend === "qstash") {
      const client = qstashClient();
      if (!client) throw new Error("QSTASH_TOKEN tanımlı değil.");
      await client.publishJSON({
        url: `${appUrl()}/api/jobs/send-email`,
        body: payload,
        retries: 3,
        deduplicationId: payload.jobKey,
      });
      return;
    }

    await processEmailJob(payload);
  } catch (error) {
    console.error(`E-posta işi kuyruğa eklenemedi (${payload.jobKey}):`, error);
    await markEnqueueFailed(payload);
  }
}

export async function enqueueEmails(payloads: EmailJobPayload[]): Promise<void> {
  if (payloads.length === 0) return;

  if (jobBackend() === "pgboss") {
    const staged: EmailJobPayload[] = [];
    for (let index = 0; index < payloads.length; index += 100) {
      const batch = payloads.slice(index, index + 100);
      const accepted = await Promise.all(batch.map((payload) => stageEmail(payload)));
      accepted.forEach((include, batchIndex) => {
        if (include) staged.push(batch[batchIndex]!);
      });
    }

    try {
      await enqueuePgBossEmails(staged);
    } catch (error) {
      console.error("E-posta işleri pg-boss kuyruğuna eklenemedi:", error);
      await Promise.all(staged.map((payload) => markEnqueueFailed(payload)));
    }
    return;
  }

  for (const payload of payloads) {
    await enqueueEmail(payload);
  }
}
