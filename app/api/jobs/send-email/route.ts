import { Receiver } from "@upstash/qstash";
import { z } from "zod";

import { processEmailJob, type EmailJobPayload } from "@/lib/email/process";
import { fail, ok } from "@/lib/errors";
import { NotificationType } from "@/lib/generated/prisma/enums";
import { appUrl } from "@/lib/jobs/qstash";

// QStash'ten gelen e-posta işlerini işler. Döküman 9.9: job endpoint'leri
// sağlayıcı imzası veya gizli anahtar ile korunur.

const payloadSchema = z.object({
  jobKey: z.string().min(1),
  type: z.enum(NotificationType),
  to: z.string().min(3),
  recipientUserId: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()),
});

async function isAuthorized(req: Request, rawBody: string): Promise<boolean> {
  // 1) QStash imzası
  const signature = req.headers.get("upstash-signature");
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (signature && currentKey && nextKey) {
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      });
      return await receiver.verify({
        signature,
        body: rawBody,
        url: `${appUrl()}/api/jobs/send-email`,
      });
    } catch {
      return false;
    }
  }

  // 2) Gizli anahtar (manuel tetikleme / test)
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  return Boolean(cronSecret && auth === `Bearer ${cronSecret}`);
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!(await isAuthorized(req, rawBody))) {
    return fail("UNAUTHORIZED", "Geçersiz imza veya anahtar.");
  }

  let payload: EmailJobPayload;
  try {
    payload = payloadSchema.parse(JSON.parse(rawBody)) as EmailJobPayload;
  } catch {
    return fail("VALIDATION_ERROR", "Geçersiz iş verisi.");
  }

  const result = await processEmailJob(payload);
  if (result === "FAILED") {
    // 500 dönerek QStash'in retry mekanizmasını tetikleriz.
    return fail("INTERNAL_ERROR", "E-posta gönderilemedi.");
  }
  return ok({ result });
}
