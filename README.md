# Akran Değerlendirme ve Ödev Yönetim Sistemi

Öğretmenin ön onayladığı e-posta adresleriyle kayıt olan öğrencilerin ödevlerini bağlantılar
üzerinden teslim ettiği, teslim süresi sonunda otomatik akran değerlendirme atamalarının
yapıldığı full-stack web uygulaması.

Bağlayıcı iş kuralları: [akran-degerlendirme-sistemi-birlesik-dokuman.md](akran-degerlendirme-sistemi-birlesik-dokuman.md)

## Teknoloji

- Next.js 16 App Router + React 19 + TypeScript
- Prisma 7 + PostgreSQL
- PostgreSQL tabanlı pg-boss queue/worker ve kod içinde yönetilen cron takvimi
- İsteğe bağlı, pasif Vercel/QStash geri dönüş altyapısı
- Nodemailer/SMTP, Zod, shadcn/ui ve Tailwind CSS 4

## Yerel kurulum

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run db:seed
npm run dev
```

Yerel geliştirmede `JOB_BACKEND=inline` ve `EMAIL_MODE=log` kullanılabilir. Production
davranışını yerelde denemek için `JOB_BACKEND=pgboss` ayarlayıp ikinci terminalde çalıştırın:

```bash
npm run worker
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Next.js geliştirme sunucusu |
| `npm run build` | Production build |
| `npm start` | Migration + production web sunucusu |
| `npm run worker` | Migration + pg-boss worker ve scheduler |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript kontrolü |
| `npm test` | Vitest testleri |
| `npm run db:deploy` | Production migration |
| `npm run db:seed` | İlk öğretmen hesabını oluşturur |

## Production

Birincil platform Coolify'dır. Web ve worker aynı Docker image'dan iki ayrı resource olarak
çalışır; PostgreSQL üçüncü resource'tur. Kesin kurulum değerleri ve ilk deploy sırası için
[COOLIFY.md](COOLIFY.md) dosyasını izleyin.

Vercel altyapısı pasif olarak korunur. `vercel.json` cron içermez ve QStash yalnızca
`JOB_BACKEND=qstash` açıkça seçildiğinde kullanılır.
