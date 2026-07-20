# Akran Değerlendirme ve Ödev Yönetim Sistemi

Öğretmenin ön onayladığı (white-list) e-posta adresleriyle kayıt olan öğrencilerin
ödevlerini bağlantılar üzerinden teslim ettiği, teslim süresi bitiminde otomatik
akran değerlendirme atamalarının yapıldığı full-stack web uygulaması.

> Bağlayıcı spesifikasyon: [akran-degerlendirme-sistemi-birlesik-dokuman.md](akran-degerlendirme-sistemi-birlesik-dokuman.md)
> — tüm iş kuralları (FR-\*), güvenlik gereksinimleri (NFR-\*) ve kabul kriterleri oradan gelir.

## Teknoloji

- **Next.js 16** (App Router, Route Handlers) + **TypeScript** — tek proje, tek deploy
- **Prisma 7** + **Supabase PostgreSQL** (yalnızca veritabanı; erişim yalnız sunucu tarafında)
- **Kendi JWT sistemimiz** (jose, HS256): access 15dk + refresh 7g rotation; HttpOnly cookie; bcryptjs
- **Zod** doğrulama, Postgres tabanlı rate limit (Redis yok)
- **Upstash QStash** asenkron e-posta kuyruğu + **Vercel Cron / QStash Schedules** zamanlanmış işler
- **Nodemailer/SMTP** e-posta, **shadcn/ui + Tailwind v4**, **exceljs** rapor dışa aktarma

## Roller ve akış

- **Öğretmen:** white-list (manuel + CSV/Excel import), ders/modül/ödev/rubrik yönetimi,
  teslim havuzu, akran atama, raporlar (CSV + Excel).
- **Öğrenci:** white-list ile kayıt, ödev teslimi (başlık + açıklama + http/https bağlantılar),
  ödev havuzu ve yorumlar, kendisine atanan iki teslimi rubrik üzerinden değerlendirme.
- Değerlendiren öğrencinin kimliği teslim sahibine **hiçbir zaman** gösterilmez.

## Kurulum

```bash
npm install
cp .env.example .env      # değerleri doldur (DB, JWT, SMTP, QStash, CRON_SECRET)
npx prisma migrate deploy # veya geliştirmede: npx prisma migrate dev
npm run db:seed           # INITIAL_TEACHER_* env'inden öğretmen hesabı
npm run dev
```

Öğretmen hesabını CLI ile de oluşturabilirsiniz:
`npx tsx scripts/create-teacher.ts --email a@b.c --password "..." --name "Ad Soyad"`

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest (unit + integration) |
| `npm run db:migrate` / `db:deploy` / `db:studio` / `db:seed` | Prisma işlemleri |

## Ortam değişkenleri

Tümü [.env.example](.env.example)'da belgelidir. Gerçek değerler yalnız yerel `.env`
(git'e girmez) ve Vercel Environment Variables'ta tutulur. `DATABASE_URL`/`DIRECT_URL`
ve diğer secret'lar **asla** `NEXT_PUBLIC_` ile tanımlanmaz.

## Deployment

Vercel'e deploy edilir. Vercel Hobby planı gün-içi cron'a izin vermediğinden zamanlanmış
işler **QStash Schedules** üzerinden `/api/cron/*` endpoint'lerini `CRON_SECRET` ile tetikler.
Production migration: `npx prisma migrate deploy`.
