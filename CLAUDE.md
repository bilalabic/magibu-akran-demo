# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Bağlayıcı Spesifikasyon

Bu depo **Akran Değerlendirme ve Ödev Yönetim Sistemi**'dir. [akran-degerlendirme-sistemi-birlesik-dokuman.md](akran-degerlendirme-sistemi-birlesik-dokuman.md) projenin bağlayıcı SRS + mimari + veri modeli dökümanıdır; tüm iş kuralları (FR-*), güvenlik gereksinimleri (NFR-*) ve kabul kriterleri oradan gelir. Çelişki durumunda döküman kazanır.

### Asla yapılmayacaklar (döküman Bölüm 23)

- Supabase Auth / Storage / Realtime / frontend SDK kullanmak — Supabase **yalnızca** PostgreSQL sağlayıcısıdır
- Ayrı Express/NestJS API, BullMQ worker veya Redis zorunluluğu eklemek
- Dosya yükleme özelliği eklemek (teslimler yalnız başlık + açıklama + http/https bağlantılar)
- Öğrenci kaydını white-list dışına açmak
- Değerlendiren öğrencinin kimliğini teslim sahibine göstermek (API response'larında reviewer bilgisi serialize edilmez)
- Veritabanı bağlantısını browser tarafına taşımak; `DATABASE_URL`/secret'ları `NEXT_PUBLIC_` ile tanımlamak

## Komutlar

```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint
npx tsc --noEmit         # Tip kontrolü
npm test                 # Vitest (tüm testler)
npx vitest run tests/unit/peer-matching.test.ts   # Tek test dosyası

npx prisma migrate dev --name <ad>   # Yerel migration (DIRECT_URL kullanır)
npx prisma migrate deploy            # Production migration
npx prisma studio                    # DB görüntüleme
npm run db:seed                      # Seed (INITIAL_TEACHER_* env'den öğretmen)
npx tsx scripts/create-teacher.ts    # Öğretmen hesabı CLI
```

## Mimari

Tek Next.js 16 (App Router) projesi; frontend + backend aynı deploy (Vercel). Backend = Route Handlers (`app/api/**/route.ts`).

- **Veritabanı:** Supabase PostgreSQL (proje ref: `dpewewutaapkperlwlli`, eu-central-1), erişim yalnızca sunucu tarafında Prisma Client (`lib/db/prisma.ts` singleton). `DATABASE_URL` = pooler (6543, pgbouncer), `DIRECT_URL` = migration için direkt bağlantı.
- **Auth:** Kendi JWT sistemimiz (jose). Access 15m + refresh 7d; refresh token'ın **hash'i** `Session` tablosunda (rotation + revoke). HttpOnly cookie'ler. bcryptjs hash. Kayıt yalnız `WhitelistEntry` (PENDING) üzerinden, tek transaction'da kullanıcı + whitelist REGISTERED + aktif derslere otomatik `CourseMembership`. Her endpoint kendi authentication/authorization/Zod validation'ını yapar (`lib/auth/authorization.ts`) — sayfa koruması `proxy.ts`'te ama API güvenliği ona güvenmez.
- **Rate limit:** Postgres tabanlı (`RateLimitEntry`), Redis yok — auth endpoint'lerine uygulanır.
- **Asenkron işler:** Upstash QStash → `POST /api/jobs/*` endpoint'leri (imza doğrulamalı). E-posta Nodemailer/SMTP. Her bildirim `NotificationLog.jobKey` unique alanıyla **idempotent** (formatlar döküman 15.5). QStash token yoksa dev'de inline fallback; `EMAIL_MODE=log` dev'de SMTP yerine loglar.
- **Zamanlanmış işler:** Vercel Cron → `GET /api/cron/*` (CRON_SECRET Bearer korumalı): ödev durum geçişleri (tarih bazlı durum makinesi `lib/assignments/status.ts`), teslim/değerlendirme hatırlatmaları, haftalık rapor.
- **Akran eşleştirme:** `lib/assignments/peer-matching.ts` saf fonksiyon; yalnız SUBMITTED/LOCKED teslimler, kendi teslimi hariç, dengeli dağılım, transaction + idempotent (tekrar çalıştırma mükerrer atama üretmez).
- **Kritik iş kuralları:** teslim güncelleme yalnız süre bitene dek; teslim başına tek aktif kayıt (`@@unique([assignmentId, studentId])`); kesinleşen değerlendirme kilitlenir; URL'ler yalnız http/https (`lib/validation/url.ts`).

### Next.js 16 notları

- `middleware.ts` yerine **`proxy.ts`** (kök dizinde, `proxy` fonksiyonu export edilir).
- Route Handler / page `params` ve `searchParams` **Promise**'dir: `{ params }: { params: Promise<{ id: string }> }` → `await params`.
- `cookies()` / `headers()` async'tir.
- Şüphede kalınca `node_modules/next/dist/docs/` altındaki sürümle gelen dokümana bak.

## Konvansiyonlar

- UI dili **Türkçe**; tarihler DB'de UTC, arayüzde Europe/Istanbul.
- shadcn/ui + Tailwind v4; dış bağlantılar `target="_blank" rel="noopener noreferrer"`.
- API cevap formatı standart: `{ success, data }` / `{ success: false, error: { code, message } }` (`lib/errors/`). Hata mesajlarında stack trace/secret sızdırılmaz.
- Ortam değişkenleri `.env.example`'da belgelenir; gerçek değerler yalnız `.env` (git'e girmez) ve Vercel env'de. Secret'ları koda, sohbete veya commit'e yazma.
- Liste endpoint'lerinde pagination zorunlu.
