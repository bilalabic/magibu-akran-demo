import "server-only";

import { sendMail } from "@/lib/email/mailer";
import { renderEmail, type TemplateDataMap } from "@/lib/email/templates";
import { prisma } from "@/lib/db/prisma";
import type { NotificationType } from "@/lib/generated/prisma/enums";
import { NotificationStatus } from "@/lib/generated/prisma/enums";

// Hem QStash job endpoint'i hem de dev inline fallback bu fonksiyonu kullanır.
// NotificationLog.jobKey unique olduğundan aynı iş ikinci kez SENT üretmez.

export type EmailJobPayload = {
  jobKey: string;
  type: NotificationType;
  to: string;
  recipientUserId?: string | null;
  data: Record<string, unknown>;
};

export type EmailJobResult = "SENT" | "SKIPPED" | "FAILED";

export function buildEmailPayload<T extends NotificationType>(params: {
  jobKey: string;
  type: T;
  to: string;
  recipientUserId?: string | null;
  data: TemplateDataMap[T];
}): EmailJobPayload {
  return {
    jobKey: params.jobKey,
    type: params.type,
    to: params.to,
    recipientUserId: params.recipientUserId ?? null,
    data: params.data as Record<string, unknown>,
  };
}

export async function processEmailJob(payload: EmailJobPayload): Promise<EmailJobResult> {
  const rendered = renderEmail(
    payload.type,
    payload.data as TemplateDataMap[typeof payload.type],
  );

  const existing = await prisma.notificationLog.findUnique({
    where: { jobKey: payload.jobKey },
  });
  if (existing?.status === NotificationStatus.SENT) {
    return "SKIPPED";
  }

  await prisma.notificationLog.upsert({
    where: { jobKey: payload.jobKey },
    update: {
      subject: rendered.subject,
      recipientEmail: payload.to,
      recipientUserId: payload.recipientUserId ?? null,
      metadata: payload.data as object,
    },
    create: {
      jobKey: payload.jobKey,
      type: payload.type,
      status: NotificationStatus.PENDING,
      recipientEmail: payload.to,
      recipientUserId: payload.recipientUserId ?? null,
      subject: rendered.subject,
      attempts: 0,
      scheduledFor: new Date(),
      metadata: payload.data as object,
    },
  });

  // Aynı QStash işi veya manuel retry eşzamanlı gelirse yalnızca bir süreç SMTP
  // gönderimini sahiplenir. Eski PROCESSING kayıtları worker çökmesine karşı
  // on dakika sonra tekrar sahiplenilebilir.
  const claimTime = new Date();
  const staleProcessing = new Date(claimTime.getTime() - 10 * 60 * 1000);
  const claimed = await prisma.notificationLog.updateMany({
    where: {
      jobKey: payload.jobKey,
      OR: [
        { status: { in: [NotificationStatus.PENDING, NotificationStatus.FAILED] } },
        {
          status: NotificationStatus.PROCESSING,
          processingStartedAt: { lt: staleProcessing },
        },
      ],
    },
    data: {
      status: NotificationStatus.PROCESSING,
      processingStartedAt: claimTime,
      attempts: { increment: 1 },
      subject: rendered.subject,
      errorMessage: null,
    },
  });
  if (claimed.count === 0) return "SKIPPED";

  try {
    const result = await sendMail({
      to: payload.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await prisma.notificationLog.update({
      where: { jobKey: payload.jobKey },
      data: {
        status: NotificationStatus.SENT,
        processingStartedAt: null,
        sentAt: new Date(),
        providerId: result.providerId,
        errorMessage: null,
      },
    });
    return "SENT";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen e-posta hatası";
    await prisma.notificationLog.update({
      where: { jobKey: payload.jobKey },
      data: {
        status: NotificationStatus.FAILED,
        processingStartedAt: null,
        failedAt: new Date(),
        errorMessage: message.slice(0, 500),
      },
    });
    return "FAILED";
  }
}
