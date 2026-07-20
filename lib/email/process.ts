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

  const log = await prisma.notificationLog.upsert({
    where: { jobKey: payload.jobKey },
    update: {
      status: NotificationStatus.PENDING,
      attempts: { increment: 1 },
      subject: rendered.subject,
    },
    create: {
      jobKey: payload.jobKey,
      type: payload.type,
      status: NotificationStatus.PENDING,
      recipientEmail: payload.to,
      recipientUserId: payload.recipientUserId ?? null,
      subject: rendered.subject,
      attempts: 1,
      scheduledFor: new Date(),
      metadata: payload.data as object,
    },
  });

  try {
    const result = await sendMail({
      to: payload.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        providerId: result.providerId,
        errorMessage: null,
      },
    });
    return "SENT";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen e-posta hatası";
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.FAILED,
        failedAt: new Date(),
        errorMessage: message.slice(0, 500),
      },
    });
    return "FAILED";
  }
}
