import "server-only";

import { Receiver } from "@upstash/qstash";

import { ApiError } from "@/lib/errors";
import { appUrl } from "@/lib/jobs/qstash";

// Döküman 9.9: Cron endpoint'leri gizli anahtar veya sağlayıcı imzasıyla korunur.
// - Vercel Cron: Authorization: Bearer ${CRON_SECRET}
// - QStash Schedules (Hobby plan alternatifi): Upstash-Signature başlığı
export async function verifyCronRequest(req: Request, path: string): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return;

  const signature = req.headers.get("upstash-signature");
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (signature && currentKey && nextKey) {
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      });
      const valid = await receiver.verify({
        signature,
        body: "",
        url: `${appUrl()}${path}`,
      });
      if (valid) return;
    } catch {
      // düşer ve aşağıda reddedilir
    }
  }

  throw new ApiError("UNAUTHORIZED", "Geçersiz cron kimlik doğrulaması.");
}
