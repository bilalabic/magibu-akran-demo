import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";

// NFR-1.5: Giriş endpoint'lerine rate limit.
// Redis kullanılmadığı için (döküman Bölüm 23) Postgres tabanlı fixed-window
// sayaç kullanılır: (key, windowStart) unique satırında atomik increment.

export type RateLimitRule = {
  // Örn. "login", "register" — anahtar öneki
  action: string;
  // Pencere başına izin verilen istek sayısı
  limit: number;
  // Pencere süresi (ms)
  windowMs: number;
};

export const RATE_LIMITS = {
  login: { action: "login", limit: 10, windowMs: 60_000 },
  register: { action: "register", limit: 5, windowMs: 60_000 },
  forgotPassword: { action: "forgot-password", limit: 3, windowMs: 600_000 },
  refresh: { action: "refresh", limit: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Limit aşıldıysa ApiError(RATE_LIMITED) fırlatır.
export async function enforceRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / rule.windowMs) * rule.windowMs);
  const key = `${rule.action}:${identifier}`;

  const entry = await prisma.rateLimitEntry.upsert({
    where: { key_windowStart: { key, windowStart } },
    update: { count: { increment: 1 } },
    create: { key, windowStart, count: 1 },
  });

  // Eski pencereleri ara sıra temizle (yaklaşık her 50 istekte bir).
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.rateLimitEntry
      .deleteMany({ where: { windowStart: { lt: cutoff } } })
      .catch(() => undefined);
  }

  if (entry.count > rule.limit) {
    throw new ApiError(
      "RATE_LIMITED",
      "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.",
    );
  }
}
