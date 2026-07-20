import "server-only";

import { Client } from "@upstash/qstash";

import { processEmailJob, type EmailJobPayload } from "@/lib/email/process";
import { prisma } from "@/lib/db/prisma";
import { NotificationStatus } from "@/lib/generated/prisma/enums";

// Asenkron e-posta kuyruğu (döküman 2.5 / 15):
// - QSTASH_TOKEN varsa iş QStash'e publish edilir, /api/jobs/send-email'i çağırır.
// - Yoksa (veya hedef localhost ise, QStash localhost'a erişemez) dev fallback
//   olarak iş inline çalıştırılır. Her iki yolda da idempotency NotificationLog
//   üzerinden sağlanır.

export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

function qstashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token, baseUrl: process.env.QSTASH_URL || undefined });
}

function canUseQstash(): boolean {
  if (!process.env.QSTASH_TOKEN) return false;
  const url = appUrl();
  return !(url.includes("localhost") || url.includes("127.0.0.1"));
}

// E-posta işini kuyruğa ekler. Çağıran akışı asla bloklamaz/bozamaz:
// hata durumunda loglanır ve NotificationLog FAILED işaretlenir (NFR-2.1).
export async function enqueueEmail(payload: EmailJobPayload): Promise<void> {
  try {
    const existing = await prisma.notificationLog.findUnique({
      where: { jobKey: payload.jobKey },
      select: { status: true },
    });
    if (existing?.status === NotificationStatus.SENT) return;

    if (canUseQstash()) {
      const client = qstashClient();
      if (!client) return;
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
        },
      })
      .catch(() => undefined);
  }
}

export async function enqueueEmails(payloads: EmailJobPayload[]): Promise<void> {
  for (const payload of payloads) {
    await enqueueEmail(payload);
  }
}
