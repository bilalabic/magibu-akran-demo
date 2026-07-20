# Coolify production kurulumu

Bu proje Coolify'da üç ayrı resource olarak çalışır:

1. PostgreSQL
2. `magibudemo-web` (public domain)
3. `magibudemo-worker` (domain yok)

Web ve worker aynı `Dockerfile` image'ını kullanır. Docker Compose kullanılmaz; böylece web
uygulamasında health check tabanlı rolling update korunur.

## 1. PostgreSQL

- Coolify'da PostgreSQL 17 resource oluşturun.
- Public port açmayın; yalnızca internal URL kullanın.
- Web ve worker resource'larında **Connect to Predefined Network** seçeneğini etkinleştirin.
- Günlük `02:30` yedeğini S3 uyumlu, sunucu dışındaki bir depoya gönderin.
- En az 14 günlük retention kullanın ve ayda bir restore testi yapın.

Coolify PostgreSQL internal URL'sini aşağıdaki üç değişkende kullanın:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
PGBOSS_DATABASE_URL=postgresql://...
```

Supabase kullanılmaya devam edilecekse `DATABASE_URL` pooler URL, `DIRECT_URL` ve
`PGBOSS_DATABASE_URL` doğrudan/session URL olmalıdır.

## 2. Web resource

| Ayar | Değer |
|---|---|
| Build Pack | Dockerfile |
| Dockerfile | `/Dockerfile` |
| Dockerfile target | `web` |
| Port Exposes | `3000` |
| Port Mapping | boş |
| Domain | `https://<alan-adınız>` |
| Start command | boş; Dockerfile CMD kullanılır |
| Health check | etkin |
| Health path | `/api/health/ready` |
| Expected code | `200` |
| Interval / timeout | `30s` / `5s` |
| Retries / start period | `3` / `30s` |
| Rolling updates | etkin |

Dockerfile komutu önce `prisma migrate deploy`, ardından standalone Next.js sunucusunu
çalıştırır. Migration başarısızsa container healthy olmaz ve trafik almaz.

Başlangıç resource sınırları: `1 CPU`, `1 GB RAM`; gerçek kullanım ölçümlerine göre ayarlayın.

## 3. Worker resource

Aynı repository ve Dockerfile ile ikinci bir application oluşturun.

| Ayar | Değer |
|---|---|
| Build Pack | Dockerfile |
| Dockerfile target | `worker` |
| Domain | yok |
| Port | yok/public değil |
| Start command | boş; worker target CMD kullanılır |
| HTTP health check | kapalı |
| Restart policy | unless-stopped / always |

Başlangıç resource sınırları: `0.5 CPU`, `512 MB RAM`. Worker kapanırken SIGTERM alır,
aktif işleri en fazla 25 saniye bekler ve yarım kalan işler pg-boss tarafından yeniden denenir.

## Ortak production değişkenleri

Coolify Project/Environment shared variables bölümünde tanımlayın:

```env
NODE_ENV=production
TZ=Europe/Istanbul
APP_URL=https://<alan-adınız>

DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
PGBOSS_DATABASE_URL=postgresql://...
DB_POOL_MAX=5
PGBOSS_POOL_MAX=5
DB_CONNECT_TIMEOUT_MS=5000
DB_IDLE_TIMEOUT_MS=30000

JOB_BACKEND=pgboss
EMAIL_WORKER_CONCURRENCY=5
PGBOSS_SCHEMA=pgboss
JOB_LOG_RETENTION_DAYS=90
NOTIFICATION_LOG_RETENTION_DAYS=180

EMAIL_MODE=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=Akran Değerlendirme <noreply@example.com>

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CRON_SECRET=...
```

Resource'a özel değişkenler:

```env
# web
COOLIFY_APP_NAME=web
JOB_SCHEDULER_ENABLED=false

# worker
COOLIFY_APP_NAME=worker
JOB_SCHEDULER_ENABLED=true
```

`JWT_*` ve `CRON_SECRET` için en az 32 byte rastgele değer kullanın. Rolling deployment'ta
Server Function anahtarının sabit kalması için build-time değişkeni ekleyin:

```env
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64 encoded 32-byte key>
```

Coolify'ın `SOURCE_COMMIT` build argümanı varsa Next.js bunu deployment ID olarak kullanır.
Yoksa build-time `DEPLOYMENT_VERSION` tanımlanabilir.

## Worker takvimi

| İş | Cron | Saat dilimi |
|---|---|---|
| Ödev durum geçişleri | `*/2 * * * *` | Europe/Istanbul |
| Teslim hatırlatmaları | `0 * * * *` | Europe/Istanbul |
| Değerlendirme hatırlatmaları | `15 * * * *` | Europe/Istanbul |
| Haftalık öğretmen raporu | `0 9 * * 1` | Europe/Istanbul |
| Eski kayıt temizliği | `15 3 * * *` | Europe/Istanbul |
| Kuyruğa ulaşmamış e-posta recovery | `*/5 * * * *` | Europe/Istanbul |

Coolify Scheduled Tasks altında aynı business cron'larını tekrar oluşturmayın. Endpoint'ler
manuel tetikleme için korunur ve `JOB_BACKEND=pgboss` iken yalnızca kuyruğa iş ekler.

## İlk dağıtım ve doğrulama

1. PostgreSQL resource'u başlatın.
2. Web resource'u deploy edin; migration otomatik uygulanır.
3. `https://<alan-adınız>/api/health/live` ve `/api/health/ready` cevaplarını kontrol edin.
4. Worker resource'u deploy edin.
5. Worker logunda `[worker] hazır` satırını ve scheduler değerini doğrulayın.
6. Test e-postası üretip `NotificationLog` kaydının `SENT` olduğunu kontrol edin.
7. S3 yedeğini manuel tetikleyip restore prosedürünü doğrulayın.

## Vercel pasif uyumluluk

`vercel.json` korunur fakat cron listesi boştur. QStash endpoint'i ve imza doğrulaması da
korunur. Vercel tekrar etkinleştirilecekse yalnızca o ortamda:

```env
JOB_BACKEND=qstash
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
NEXT_PUBLIC_APP_URL=https://<vercel-domain>
```

tanımlanır ve QStash schedules dışarıdan eklenir. Coolify production'da bu değişkenler boş
kalır; iki altyapı aynı anda cron çalıştırmaz.
