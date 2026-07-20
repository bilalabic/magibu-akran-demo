# Akran Değerlendirme ve Ödev Yönetim Sistemi

## Birleşik SRS, Teknik Mimari, Veritabanı Tasarımı ve Claude Geliştirme Talimatı

**Doküman sürümü:** 1.0  
**Hedef platform:** Vercel  
**Veritabanı:** Supabase PostgreSQL  
**Kimlik doğrulama:** Uygulamanın kendi JWT sistemi  
**Dosya yükleme:** Yok  
**Ödev teslim biçimi:** Başlık + açıklama/odak noktası + bir veya daha fazla bağlantı

---

# 1. Projenin Özeti

Bu proje; öğretmenin önceden onayladığı e-posta adreslerine sahip öğrencilerin kayıt olabildiği, haftalık veya konu bazlı ödevlerin yönetildiği, öğrencilerin ödevlerini bağlantılar üzerinden teslim ettiği ve teslim süresi sonunda otomatik akran değerlendirme atamalarının yapıldığı full-stack bir web uygulamasıdır.

Sistemde iki temel kullanıcı rolü bulunur:

- **Öğretmen:** Sistemin yöneticisidir.
- **Öğrenci:** Ödev teslim eden ve akran değerlendirmesi yapan kullanıcıdır.

Öğrenciler sisteme doğrudan dosya yüklemez. Her ödev teslimi aşağıdaki alanlardan oluşur:

1. Tek bir başlık
2. Tek bir açıklama ve odak noktası metni
3. Bir veya daha fazla bağlantı

Bağlantılar GitHub, canlı proje, Google Docs, Figma, YouTube, sunum veya öğretmenin izin verdiği başka bir çevrim içi kaynağa ait olabilir.

---

# 2. Kesin Teknoloji Kararları

## 2.1 Uygulama

- Next.js
- TypeScript
- App Router
- Server Components
- Route Handlers
- Zod
- Prisma ORM

## 2.2 Hosting

- Vercel
- Ana alan adı doğrudan Vercel projesine bağlanacaktır.
- Ayrı bir `api.` alt alan adı zorunlu değildir.
- Frontend ve backend aynı Next.js projesinde çalışacaktır.

Örnek yapı:

```text
https://alanadiniz.com
├── /
├── /login
├── /register
├── /student
├── /teacher
└── /api/*
```

## 2.3 Veritabanı

- Supabase PostgreSQL
- Supabase yalnızca PostgreSQL veritabanı sağlayıcısı olarak kullanılacaktır.
- Supabase Auth kullanılmayacaktır.
- Supabase Storage kullanılmayacaktır.
- Frontend tarafında `supabase-js` kullanılması zorunlu değildir.
- Veritabanına yalnızca sunucu tarafındaki Prisma Client erişecektir.

## 2.4 Kimlik Doğrulama

- Özel kayıt ve giriş sistemi
- JWT access token
- JWT refresh token
- bcrypt ile şifre hashleme
- HttpOnly cookie
- White-list tabanlı kayıt
- Rol tabanlı yetkilendirme

## 2.5 Asenkron İşler ve E-posta

İlk tasarımda BullMQ ve Redis düşünülmüş olsa da, ana uygulama Vercel üzerinde çalışacağı için sürekli çalışan BullMQ worker mimarisi ana çözüm olarak kullanılmayacaktır.

Nihai yapı:

- Vercel Cron: Zamanlanmış kontroller
- Upstash QStash: Asenkron HTTP görev kuyruğu ve tekrar deneme
- Nodemailer: SMTP üzerinden e-posta gönderimi

İstenirse ileride sürekli çalışan bir Railway veya Render worker eklenerek BullMQ mimarisine geçilebilir. İlk sürümde buna gerek yoktur.

## 2.6 Dosya Depolama

- Dosya yükleme özelliği olmayacaktır.
- Supabase Storage kullanılmayacaktır.
- Veritabanında dosya yolu, MIME türü, dosya adı veya dosya boyutu tutulmayacaktır.
- Öğrenci yalnızca dış bağlantı ekleyebilecektir.

---

# 3. Sistem Mimarisi

```text
Kullanıcı
   │
   ▼
Vercel
Next.js Full-Stack Uygulama
   │
   ├── Kullanıcı Arayüzü
   ├── Route Handlers
   ├── JWT Kimlik Doğrulama
   ├── White-list Kontrolü
   ├── Öğretmen Paneli
   ├── Öğrenci Paneli
   ├── Akran Atama Servisi
   ├── Raporlama Servisi
   └── E-posta Job Endpointleri
            │
            ├── Prisma ORM
            │      │
            │      ▼
            │  Supabase PostgreSQL
            │
            ├── Upstash QStash
            │
            └── SMTP / Nodemailer
```

---

# 4. Kullanıcı Rolleri

## 4.1 Öğretmen

Öğretmen aşağıdaki işlemleri yapabilir:

- Sisteme giriş yapma
- White-list kayıtlarını görüntüleme
- Manuel e-posta ekleme
- CSV ile toplu öğrenci e-postası ekleme
- Davet e-postası gönderme
- Ödev oluşturma
- Ödev tarihlerini belirleme
- Rubrik oluşturma
- Ödevleri yayınlama
- Öğrenci teslimlerini görüntüleme
- Akran atamalarını başlatma veya izleme
- Değerlendirmeleri görüntüleme
- Yorumları yönetme
- Sonuçları CSV veya Excel olarak dışa aktarma
- Haftalık katılım ve başarı raporu alma

## 4.2 Öğrenci

Öğrenci aşağıdaki işlemleri yapabilir:

- White-list kontrolünden geçerek kayıt olma
- Sisteme giriş yapma
- Aktif ödevleri görüntüleme
- Ödev teslimi oluşturma
- Teslim süresi bitmeden teslimini güncelleme
- Ödev havuzunu görüntüleme
- Ödevlere yorum yapma
- Yorumlara yanıt verme
- Kendisine atanan iki ödevi değerlendirme
- Sonuçlarını ve geri bildirimlerini görüntüleme

---

# 5. Yazılım Gereksinimleri Spesifikasyonu

# 5.1 Giriş

## 5.1.1 Amaç

Bu doküman; ön onaylı e-posta adreslerine dayalı kayıt mekanizmasına, modüler ödev yönetimine, bağlantı tabanlı ödev teslimine, otomatik akran eşleştirmesine ve asenkron e-posta bildirim sistemine sahip Akran Değerlendirme ve Ödev Yönetim Sistemi'nin gereksinimlerini tanımlar.

## 5.1.2 Kapsam

Sistem; öğrencilerin kendi ödevlerini teslim ettiği, diğer öğrencilerin ödevlerini görüntüleyebildiği, teslim süresi bitiminde sistem tarafından atanan iki ödevi yapılandırılmış rubrik üzerinden değerlendirdiği ve öğretmenin tüm süreci yönettiği bir web uygulamasıdır.

---

# 5.2 Fonksiyonel Gereksinimler

## 5.2.1 Kimlik Doğrulama ve White-list

**FR-1.1:** Sistem dışarıdan kontrolsüz kullanıcı kaydına kapalı olmalıdır.

**FR-1.2:** Yalnızca `WhitelistEntry` tablosunda tanımlı e-posta adresleriyle öğrenci hesabı oluşturulabilmelidir.

**FR-1.3:** E-posta adresleri kayıt ve giriş işlemlerinden önce küçük harfe çevrilmeli ve boşluklardan temizlenmelidir.

**FR-1.4:** Aynı e-posta adresiyle birden fazla kullanıcı hesabı oluşturulamamalıdır.

**FR-1.5:** Kullanılmış bir white-list kaydı tekrar kullanılamamalıdır.

**FR-1.6:** Şifreler bcrypt ile hashlenerek saklanmalıdır.

**FR-1.7:** Kullanıcı girişinde kısa süreli access token ve uzun süreli refresh token oluşturulmalıdır.

**FR-1.8:** Token'lar mümkün olduğunca HttpOnly ve Secure cookie ile saklanmalıdır.

**FR-1.9:** Refresh token'ın düz değeri veritabanında tutulmamalı, hash değeri tutulmalıdır.

**FR-1.10:** Öğretmen ve öğrenci endpoint'leri rol tabanlı olarak korunmalıdır.

## 5.2.2 Öğretmen White-list Yönetimi

**FR-2.1:** Öğretmen manuel olarak öğrenci e-postası ekleyebilmelidir.

**FR-2.2:** Öğretmen CSV dosyasından toplu e-posta aktarabilmelidir.

**FR-2.3:** CSV içindeki geçersiz e-posta adresleri raporlanmalıdır.

**FR-2.4:** Aynı e-posta birden fazla kez eklenmemelidir.

**FR-2.5:** CSV import işlemi sonunda eklenen, atlanan ve hatalı satır sayıları gösterilmelidir.

**FR-2.6:** Yeni eklenen öğrencilere asenkron davet e-postası gönderilmelidir.

**FR-2.7:** Öğretmen bir white-list kaydını iptal edebilmelidir.

**FR-2.8:** Kayıt olmuş kullanıcının white-list kaydı `REGISTERED` durumunda olmalıdır.

## 5.2.3 Ödev Yönetimi

**FR-3.1:** Öğretmen haftalık veya konu bazlı modül oluşturabilmelidir.

**FR-3.2:** Her ödev aşağıdaki bilgileri içermelidir:

- Başlık
- Açıklama
- Modül veya hafta bilgisi
- Teslim başlangıç tarihi
- Teslim bitiş tarihi
- Değerlendirme başlangıç tarihi
- Değerlendirme bitiş tarihi
- Durum
- Bağlantı kuralları
- Rubrik

**FR-3.3:** Öğretmen taslak ödev oluşturabilmelidir.

**FR-3.4:** Öğretmen ödevi yayınlayabilmelidir.

**FR-3.5:** Teslim süresi başlamış veya teslim alınmış ödevlerde kritik alan değişiklikleri kontrollü yapılmalıdır.

**FR-3.6:** Ödev durumları sistem tarafından tarihlere göre güncellenebilmelidir.

Önerilen durumlar:

```text
DRAFT
PUBLISHED
SUBMISSION_OPEN
SUBMISSION_CLOSED
REVIEW_OPEN
REVIEW_CLOSED
COMPLETED
ARCHIVED
```

## 5.2.4 Ödev Teslimi

**FR-4.1:** Öğrenci doğrudan dosya yükleyememelidir.

**FR-4.2:** Her teslim aşağıdaki alanlardan oluşmalıdır:

- Tek bir başlık
- Tek bir açıklama ve odak noktası
- Bir veya daha fazla bağlantı

**FR-4.3:** Başlık zorunlu olmalıdır.

**FR-4.4:** Açıklama ve odak noktası zorunlu olmalıdır.

**FR-4.5:** En az bir bağlantı zorunlu olmalıdır.

**FR-4.6:** Bir teslimde birden fazla bağlantı bulunabilmelidir.

**FR-4.7:** Bağlantılar yalnızca `http` veya `https` protokollerine sahip olmalıdır.

**FR-4.8:** `javascript:`, `data:`, `file:` ve benzeri protokoller reddedilmelidir.

**FR-4.9:** Öğrenci teslim süresi sona erene kadar teslimini güncelleyebilmelidir.

**FR-4.10:** Teslim süresi sona erdiğinde teslim değiştirilememelidir.

**FR-4.11:** Her öğrenci aynı ödev için yalnızca bir aktif teslim oluşturabilmelidir.

**FR-4.12:** Teslim oluşturma ve güncelleme tarihleri kaydedilmelidir.

## 5.2.5 Ödev Havuzu ve Yorum Sistemi

**FR-5.1:** Öğrenciler ilgili ödevin teslim havuzunu görüntüleyebilmelidir.

**FR-5.2:** Havuz görünümünde aşağıdaki bilgiler gösterilmelidir:

- Teslim başlığı
- Açıklama ve odak noktası
- Bağlantılar
- Teslim tarihi
- Yorumlar

**FR-5.3:** Her teslimin altında yorum alanı bulunmalıdır.

**FR-5.4:** Kullanıcılar teslimlere yorum yapabilmelidir.

**FR-5.5:** Kullanıcılar mevcut yorumlara yanıt verebilmelidir.

**FR-5.6:** Yorum sistemi üst yorum ve alt yanıt ilişkisini desteklemelidir.

**FR-5.7:** Kullanıcı yalnızca kendi yorumunu düzenleyebilmeli veya silebilmelidir.

**FR-5.8:** Öğretmen tüm yorumlar üzerinde moderasyon yetkisine sahip olmalıdır.

**FR-5.9:** Bir teslime yorum yapıldığında teslim sahibine e-posta bildirimi gönderilmelidir.

**FR-5.10:** Bir yoruma yanıt verildiğinde yorum sahibine e-posta bildirimi gönderilmelidir.

## 5.2.6 Akran Atama

**FR-6.1:** Teslim süresi sona erdiğinde yalnızca teslim yapmış öğrenciler değerlendirme sürecine dahil edilmelidir.

**FR-6.2:** Her öğrenciye başka öğrencilere ait iki farklı teslim atanmalıdır.

**FR-6.3:** Öğrenciye kendi teslimi atanamaz.

**FR-6.4:** Aynı öğrenciye aynı teslim iki kez atanamaz.

**FR-6.5:** Atama dağılımı mümkün olduğunca dengeli olmalıdır.

**FR-6.6:** Bir teslimin iki değerlendirme alması hedeflenmelidir.

**FR-6.7:** Yeterli sayıda teslim yoksa sistem öğretmene hata veya uyarı göstermelidir.

**FR-6.8:** Atama işlemi veritabanı transaction'ı içinde gerçekleştirilmelidir.

**FR-6.9:** Aynı ödev için atama işlemi ikinci kez çalıştırıldığında mükerrer kayıt oluşturmamalıdır.

**FR-6.10:** Atamalar tamamlandıktan sonra öğrencilere asenkron e-posta gönderilmelidir.

## 5.2.7 Rubrik ve Akran Değerlendirmesi

**FR-7.1:** Öğretmen her ödev için rubrik tanımlayabilmelidir.

**FR-7.2:** Rubrik sayısal ve metinsel kriterleri desteklemelidir.

**FR-7.3:** Varsayılan rubrik en az iki sayısal kriter içermelidir.

**FR-7.4:** Sayısal kriterlerin varsayılan puan aralığı 1-10 olmalıdır.

**FR-7.5:** Varsayılan rubrik en az aşağıdaki metin alanlarını içermelidir:

- Başarılı Noktalar
- Geliştirilmesi Gereken Alanlar

**FR-7.6:** Öğrenci yalnızca kendisine atanmış teslimleri değerlendirebilmelidir.

**FR-7.7:** Öğrenci değerlendirmeyi taslak olarak kaydedebilmelidir.

**FR-7.8:** Öğrenci değerlendirmeyi kesin olarak gönderebilmelidir.

**FR-7.9:** Kesin gönderilmiş değerlendirme öğrenci tarafından değiştirilememelidir.

**FR-7.10:** Değerlendiren öğrencinin kimliği teslim sahibine gösterilmemelidir.

**FR-7.11:** Öğretmen tüm değerlendirme detaylarını görüntüleyebilmelidir.

## 5.2.8 E-posta Bildirimleri

**FR-8.1:** White-list'e eklenen öğrenciye davet e-postası gönderilmelidir.

**FR-8.2:** Akran ataması tamamlandığında öğrenciye yeni değerlendirme görevleri olduğu bildirilmelidir.

**FR-8.3:** Değerlendirme tamamlandığında teslim sahibine anonim değerlendirme bildirimi gönderilmelidir.

**FR-8.4:** Değerlendirme tamamlandığında öğretmene görev tamamlama özeti gönderilmelidir.

**FR-8.5:** Teslim süresine 24 saat kaldığında teslim yapmayanlara hatırlatma gönderilmelidir.

**FR-8.6:** Değerlendirme süresine 12 saat kaldığında tamamlanmamış görevler için hatırlatma gönderilmelidir.

**FR-8.7:** Teslime yorum geldiğinde teslim sahibine bildirim gönderilmelidir.

**FR-8.8:** Yoruma yanıt geldiğinde yorum sahibine bildirim gönderilmelidir.

**FR-8.9:** Süreç kapandığında öğrenciye sonuç karnesi gönderilmelidir.

**FR-8.10:** Süreç kapandığında öğretmene katılım ve başarı özeti gönderilmelidir.

## 5.2.9 Raporlama

**FR-9.1:** Öğretmen ödev bazında teslim listesini görüntüleyebilmelidir.

**FR-9.2:** Öğretmen tamamlanan ve eksik değerlendirmeleri görüntüleyebilmelidir.

**FR-9.3:** Öğretmen kriter bazlı puan ortalamalarını görüntüleyebilmelidir.

**FR-9.4:** Öğretmen genel puan ortalamalarını görüntüleyebilmelidir.

**FR-9.5:** Öğretmen tüm metinsel geri bildirimleri görüntüleyebilmelidir.

**FR-9.6:** Sonuçlar CSV formatında dışa aktarılabilmelidir.

**FR-9.7:** Sonuçlar Excel formatında dışa aktarılabilmelidir.

---

# 5.3 Fonksiyonel Olmayan Gereksinimler

## 5.3.1 Güvenlik

**NFR-1.1:** Şifreler düz metin tutulmamalıdır.

**NFR-1.2:** JWT secret değerleri kaynak koduna yazılmamalıdır.

**NFR-1.3:** Veritabanı bağlantı adresleri `NEXT_PUBLIC_` ile tanımlanmamalıdır.

**NFR-1.4:** Yetkilendirme yalnızca arayüzde değil, her API endpoint'inde kontrol edilmelidir.

**NFR-1.5:** Giriş endpoint'lerine rate limit uygulanmalıdır.

**NFR-1.6:** Form verileri Zod ile doğrulanmalıdır.

**NFR-1.7:** Kullanıcı metinleri XSS riskine karşı güvenli şekilde işlenmelidir.

**NFR-1.8:** Dış bağlantılar yeni sekmede açılırken `noopener` ve `noreferrer` kullanılmalıdır.

**NFR-1.9:** Refresh token iptal edilebilir olmalıdır.

**NFR-1.10:** Çıkış yapıldığında ilgili oturum iptal edilmelidir.

## 5.3.2 Performans

**NFR-2.1:** E-posta gönderimi request/response süresini bekletmemelidir.

**NFR-2.2:** Büyük CSV import işlemleri kontrollü şekilde işlenmelidir.

**NFR-2.3:** Sık sorgulanan alanlarda indeks kullanılmalıdır.

**NFR-2.4:** Liste endpoint'lerinde pagination kullanılmalıdır.

**NFR-2.5:** Prisma Client geliştirme ortamında tekrar tekrar oluşturulmamalıdır.

## 5.3.3 Veri Bütünlüğü

**NFR-3.1:** Kritik işlemler transaction ile yapılmalıdır.

**NFR-3.2:** Aynı kullanıcı aynı ödev için birden fazla aktif teslim oluşturamamalıdır.

**NFR-3.3:** Aynı değerlendiriciye aynı teslim birden fazla kez atanamamalıdır.

**NFR-3.4:** Tamamlanmış değerlendirme kayıtları raporlama için korunmalıdır.

**NFR-3.5:** Kullanıcı silme işlemlerinde soft delete yaklaşımı tercih edilmelidir.

## 5.3.4 Uygulanabilirlik

**NFR-4.1:** Proje Vercel üzerinde çalışabilmelidir.

**NFR-4.2:** Veritabanı Supabase PostgreSQL üzerinde çalışabilmelidir.

**NFR-4.3:** Migration işlemleri Prisma ile yönetilmelidir.

**NFR-4.4:** Yerel geliştirme, preview ve production ortamları ayrılmalıdır.

**NFR-4.5:** Projenin tüm gerekli ortam değişkenleri `.env.example` dosyasında belgelenmelidir.

---

# 6. Veri Modeli ve İlişkiler

Ana tablolar:

- User
- Session
- WhitelistEntry
- Course
- CourseMembership
- AssignmentModule
- Assignment
- Submission
- SubmissionLink
- Comment
- Rubric
- RubricCriterion
- PeerAssignment
- PeerReview
- ReviewAnswer
- NotificationLog
- ScheduledJobLog

## 6.1 Temel İlişkiler

```text
User
├── Session[]
├── CourseMembership[]
├── Submission[]
├── Comment[]
├── PeerAssignment[] as reviewer
├── PeerReview[]
└── WhitelistEntry?

Course
├── CourseMembership[]
├── AssignmentModule[]
└── Assignment[]

AssignmentModule
└── Assignment[]

Assignment
├── Submission[]
├── Rubric
└── PeerAssignment[]

Submission
├── SubmissionLink[]
├── Comment[]
└── PeerAssignment[]

Rubric
└── RubricCriterion[]

PeerAssignment
└── PeerReview

PeerReview
└── ReviewAnswer[]
```

---

# 7. Prisma Şeması

Aşağıdaki şema projenin başlangıç veri modelidir. Claude gerekli küçük iyileştirmeleri yapabilir ancak ilişkileri ve ana iş kurallarını korumalıdır.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  TEACHER
  STUDENT
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

enum WhitelistStatus {
  PENDING
  REGISTERED
  REVOKED
}

enum CourseRole {
  TEACHER
  STUDENT
}

enum AssignmentStatus {
  DRAFT
  PUBLISHED
  SUBMISSION_OPEN
  SUBMISSION_CLOSED
  REVIEW_OPEN
  REVIEW_CLOSED
  COMPLETED
  ARCHIVED
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
  LOCKED
}

enum CriterionType {
  SCORE
  TEXT
}

enum PeerAssignmentStatus {
  ASSIGNED
  IN_PROGRESS
  COMPLETED
  EXPIRED
}

enum PeerReviewStatus {
  DRAFT
  SUBMITTED
}

enum NotificationType {
  INVITATION
  PEER_ASSIGNMENT
  REVIEW_COMPLETED_OWNER
  REVIEW_COMPLETED_TEACHER
  SUBMISSION_REMINDER
  REVIEW_REMINDER
  SUBMISSION_COMMENT
  COMMENT_REPLY
  STUDENT_REPORT
  TEACHER_WEEKLY_REPORT
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  name         String
  passwordHash String
  role         UserRole   @default(STUDENT)
  status       UserStatus @default(ACTIVE)

  lastLoginAt DateTime?
  deletedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  whitelistEntry WhitelistEntry?
  sessions       Session[]
  memberships    CourseMembership[]
  submissions    Submission[]
  comments       Comment[]
  peerAssignments PeerAssignment[] @relation("ReviewerAssignments")
  peerReviews     PeerReview[]
  createdCourses  Course[]          @relation("CourseCreator")
  createdAssignments Assignment[]   @relation("AssignmentCreator")

  @@index([role])
  @@index([status])
}

model Session {
  id               String   @id @default(cuid())
  refreshTokenHash String   @unique
  userAgent        String?
  ipAddress        String?
  expiresAt        DateTime
  revokedAt        DateTime?
  lastUsedAt       DateTime?

  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
  @@index([revokedAt])
}

model WhitelistEntry {
  id     String          @id @default(cuid())
  email  String          @unique
  role   UserRole        @default(STUDENT)
  status WhitelistStatus @default(PENDING)

  invitedAt    DateTime?
  registeredAt DateTime?
  revokedAt    DateTime?

  userId String? @unique
  user   User?   @relation(fields: [userId], references: [id])

  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
  @@index([role])
}

model Course {
  id          String  @id @default(cuid())
  name        String
  description String?
  isActive    Boolean @default(true)

  createdById String
  createdBy   User @relation("CourseCreator", fields: [createdById], references: [id])

  memberships CourseMembership[]
  modules     AssignmentModule[]
  assignments Assignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([createdById])
  @@index([isActive])
}

model CourseMembership {
  id     String     @id @default(cuid())
  role   CourseRole @default(STUDENT)
  joinedAt DateTime @default(now())
  leftAt   DateTime?

  userId   String
  courseId String

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([courseId, role])
}

model AssignmentModule {
  id          String  @id @default(cuid())
  title       String
  description String?
  order       Int
  isActive    Boolean @default(true)

  courseId String
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  assignments Assignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([courseId, order])
  @@index([courseId])
}

model Assignment {
  id          String           @id @default(cuid())
  title       String
  description String
  linkRules   String?
  status      AssignmentStatus @default(DRAFT)

  submissionStartsAt DateTime
  submissionEndsAt   DateTime
  reviewStartsAt     DateTime
  reviewEndsAt       DateTime

  requiredReviewCount Int @default(2)
  isAnonymous         Boolean @default(true)

  courseId  String
  moduleId  String?
  createdById String

  course    Course            @relation(fields: [courseId], references: [id], onDelete: Cascade)
  module    AssignmentModule? @relation(fields: [moduleId], references: [id], onDelete: SetNull)
  createdBy User              @relation("AssignmentCreator", fields: [createdById], references: [id])

  rubric          Rubric?
  submissions     Submission[]
  peerAssignments PeerAssignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([courseId])
  @@index([moduleId])
  @@index([status])
  @@index([submissionEndsAt])
  @@index([reviewEndsAt])
}

model Submission {
  id          String           @id @default(cuid())
  title       String
  description String
  status      SubmissionStatus @default(DRAFT)

  submittedAt DateTime?
  lockedAt    DateTime?

  assignmentId String
  studentId    String

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  student    User       @relation(fields: [studentId], references: [id], onDelete: Cascade)

  links           SubmissionLink[]
  comments        Comment[]
  peerAssignments PeerAssignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([assignmentId, studentId])
  @@index([assignmentId, status])
  @@index([studentId])
}

model SubmissionLink {
  id        String @id @default(cuid())
  label     String?
  url       String
  sortOrder Int    @default(0)

  submissionId String
  submission   Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([submissionId, sortOrder])
}

model Comment {
  id        String  @id @default(cuid())
  content   String
  isDeleted Boolean @default(false)
  editedAt  DateTime?
  deletedAt DateTime?

  submissionId String
  authorId     String
  parentId     String?

  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  author     User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parent     Comment?   @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies    Comment[]  @relation("CommentReplies")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([submissionId, createdAt])
  @@index([authorId])
  @@index([parentId])
}

model Rubric {
  id          String  @id @default(cuid())
  title       String
  description String?

  assignmentId String @unique
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  criteria RubricCriterion[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model RubricCriterion {
  id          String        @id @default(cuid())
  title       String
  description String?
  type        CriterionType
  required    Boolean       @default(true)
  order       Int

  minScore Int?
  maxScore Int?
  weight   Decimal? @db.Decimal(5, 2)

  rubricId String
  rubric   Rubric @relation(fields: [rubricId], references: [id], onDelete: Cascade)

  answers ReviewAnswer[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([rubricId, order])
  @@index([rubricId, type])
}

model PeerAssignment {
  id     String               @id @default(cuid())
  status PeerAssignmentStatus @default(ASSIGNED)

  assignedAt  DateTime @default(now())
  startedAt   DateTime?
  completedAt DateTime?
  expiresAt   DateTime

  assignmentId String
  submissionId String
  reviewerId   String

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  reviewer   User       @relation("ReviewerAssignments", fields: [reviewerId], references: [id], onDelete: Cascade)

  review PeerReview?

  @@unique([assignmentId, reviewerId, submissionId])
  @@index([reviewerId, status])
  @@index([assignmentId, status])
  @@index([submissionId])
  @@index([expiresAt])
}

model PeerReview {
  id          String           @id @default(cuid())
  status      PeerReviewStatus @default(DRAFT)
  submittedAt DateTime?

  peerAssignmentId String @unique
  reviewerId       String

  peerAssignment PeerAssignment @relation(fields: [peerAssignmentId], references: [id], onDelete: Cascade)
  reviewer       User           @relation(fields: [reviewerId], references: [id], onDelete: Cascade)

  answers ReviewAnswer[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([reviewerId])
  @@index([status])
}

model ReviewAnswer {
  id        String @id @default(cuid())
  score     Int?
  textValue String?

  peerReviewId String
  criterionId  String

  peerReview PeerReview      @relation(fields: [peerReviewId], references: [id], onDelete: Cascade)
  criterion  RubricCriterion @relation(fields: [criterionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([peerReviewId, criterionId])
  @@index([criterionId])
}

model NotificationLog {
  id      String             @id @default(cuid())
  type    NotificationType
  status  NotificationStatus @default(PENDING)
  jobKey  String             @unique

  recipientEmail String
  recipientUserId String?
  subject        String?
  errorMessage   String?
  providerId     String?
  attempts       Int @default(0)

  scheduledFor DateTime?
  sentAt       DateTime?
  failedAt     DateTime?

  metadata Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([type, status])
  @@index([recipientUserId])
  @@index([scheduledFor])
}

model ScheduledJobLog {
  id       String @id @default(cuid())
  jobKey   String @unique
  jobType  String
  status   String
  payload  Json?
  result   Json?
  error    String?

  startedAt  DateTime?
  finishedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([jobType, status])
}
```

---

# 8. Önemli Veri Kuralları

## 8.1 Kayıt Transaction'ı

Kullanıcı kaydı aşağıdaki işlemleri tek transaction içinde yapmalıdır:

1. White-list kaydını bul
2. Durumunun `PENDING` olduğunu doğrula
3. Kullanıcının daha önce bulunmadığını doğrula
4. Şifreyi hashle
5. Kullanıcı oluştur
6. White-list kaydını kullanıcıya bağla
7. White-list durumunu `REGISTERED` yap
8. `registeredAt` tarihini kaydet

## 8.2 Teslim Kuralları

- Aynı öğrenci aynı ödev için tek teslim oluşturur.
- Teslimin bağlantıları ayrı tabloda tutulur.
- Güncelleme sırasında bağlantılar transaction içinde yeniden düzenlenebilir.
- Süre bittiyse güncelleme reddedilir.
- Dosya alanı eklenmez.

## 8.3 Akran Atama Kuralları

- Yalnızca `SUBMITTED` veya `LOCKED` durumundaki teslimler kullanılır.
- Kullanıcıya kendi teslimi atanmaz.
- Aynı kullanıcı aynı teslimi iki kez alamaz.
- Her kullanıcı için hedef atama sayısı ödevdeki `requiredReviewCount` değeridir.
- Mümkün olduğunca her teslim eşit sayıda değerlendirme almalıdır.
- Atama işlemi yeniden çalıştırıldığında mükerrer kayıt oluşturmamalıdır.
- Atama işlemi transaction içinde yapılmalıdır.

## 8.4 Değerlendirme Kuralları

- Yalnızca atanan kullanıcı değerlendirme yapabilir.
- Her kriter için tek cevap bulunur.
- Sayısal kriterlerde puan min/max sınırında olmalıdır.
- Metin kriterlerinde metin değeri zorunlu olabilir.
- Kesin gönderimde tüm zorunlu kriterler doldurulmalıdır.
- Gönderim sonrasında kayıt kilitlenir.

---

# 9. API Tasarımı

## 9.1 Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## 9.2 Öğretmen White-list

```text
GET    /api/teacher/whitelist
POST   /api/teacher/whitelist
POST   /api/teacher/whitelist/import
PATCH  /api/teacher/whitelist/:id
DELETE /api/teacher/whitelist/:id
POST   /api/teacher/whitelist/:id/send-invitation
```

## 9.3 Ders ve Modüller

```text
GET    /api/courses
POST   /api/teacher/courses
GET    /api/courses/:id
PATCH  /api/teacher/courses/:id
POST   /api/teacher/courses/:id/members
GET    /api/teacher/courses/:id/members
POST   /api/teacher/courses/:id/modules
PATCH  /api/teacher/modules/:id
```

## 9.4 Ödevler

```text
GET    /api/assignments
POST   /api/teacher/assignments
GET    /api/assignments/:id
PATCH  /api/teacher/assignments/:id
POST   /api/teacher/assignments/:id/publish
POST   /api/teacher/assignments/:id/close-submissions
POST   /api/teacher/assignments/:id/generate-peer-assignments
POST   /api/teacher/assignments/:id/close-reviews
POST   /api/teacher/assignments/:id/complete
```

## 9.5 Teslimler

```text
GET    /api/assignments/:id/submission
POST   /api/assignments/:id/submission
PATCH  /api/assignments/:id/submission
POST   /api/assignments/:id/submission/submit
GET    /api/assignments/:id/submissions
GET    /api/submissions/:id
```

Örnek teslim isteği:

```json
{
  "title": "1. Hafta Web Uygulaması",
  "description": "Projede kimlik doğrulama, form doğrulama ve responsive tasarıma odaklandım.",
  "links": [
    {
      "label": "GitHub",
      "url": "https://github.com/ornek/proje"
    },
    {
      "label": "Canlı Proje",
      "url": "https://ornek-proje.vercel.app"
    }
  ]
}
```

## 9.6 Yorumlar

```text
GET    /api/submissions/:id/comments
POST   /api/submissions/:id/comments
PATCH  /api/comments/:id
DELETE /api/comments/:id
POST   /api/comments/:id/replies
```

## 9.7 Akran Değerlendirmeleri

```text
GET    /api/peer-assignments
GET    /api/peer-assignments/:id
POST   /api/peer-assignments/:id/review
PATCH  /api/peer-assignments/:id/review
POST   /api/peer-assignments/:id/review/submit
```

## 9.8 Raporlar

```text
GET /api/teacher/assignments/:id/reports/summary
GET /api/teacher/assignments/:id/reports/export.csv
GET /api/teacher/assignments/:id/reports/export.xlsx
GET /api/student/assignments/:id/report
```

## 9.9 Cron ve Job Endpointleri

```text
GET  /api/cron/process-assignment-statuses
GET  /api/cron/submission-reminders
GET  /api/cron/review-reminders
GET  /api/cron/weekly-teacher-report

POST /api/jobs/send-email
POST /api/jobs/generate-peer-assignments
POST /api/jobs/send-student-report
POST /api/jobs/send-teacher-report
```

Cron ve job endpoint'leri gizli anahtar veya sağlayıcı imza doğrulaması ile korunmalıdır.

---

# 10. Klasör Yapısı

```text
peer-review-system/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── student/
│   │   │   ├── page.tsx
│   │   │   ├── assignments/
│   │   │   ├── reviews/
│   │   │   └── results/
│   │   └── teacher/
│   │       ├── page.tsx
│   │       ├── whitelist/
│   │       ├── courses/
│   │       ├── assignments/
│   │       └── reports/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── assignments/
│   │   ├── submissions/
│   │   ├── comments/
│   │   ├── peer-assignments/
│   │   ├── teacher/
│   │   │   ├── whitelist/
│   │   │   ├── courses/
│   │   │   ├── assignments/
│   │   │   └── reports/
│   │   ├── cron/
│   │   └── jobs/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth/
│   ├── assignments/
│   ├── submissions/
│   ├── reviews/
│   ├── comments/
│   ├── teacher/
│   └── ui/
├── lib/
│   ├── auth/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── cookies.ts
│   │   ├── session.ts
│   │   └── authorization.ts
│   ├── db/
│   │   └── prisma.ts
│   ├── email/
│   │   ├── mailer.ts
│   │   ├── queue.ts
│   │   └── templates/
│   ├── jobs/
│   │   ├── qstash.ts
│   │   └── idempotency.ts
│   ├── assignments/
│   │   ├── status.ts
│   │   └── peer-matching.ts
│   ├── reports/
│   │   ├── csv.ts
│   │   └── excel.ts
│   ├── validation/
│   ├── errors/
│   └── utils/
├── server/
│   ├── repositories/
│   ├── services/
│   └── policies/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/
│   ├── create-teacher.ts
│   ├── import-whitelist.ts
│   └── verify-database.ts
├── types/
├── middleware.ts
├── vercel.json
├── prisma.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

# 11. Ortam Değişkenleri

`.env.example` dosyası:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

DATABASE_URL=
DIRECT_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=12

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Akran Değerlendirme <noreply@example.com>"

QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

CRON_SECRET=

INITIAL_TEACHER_EMAIL=
INITIAL_TEACHER_PASSWORD=
INITIAL_TEACHER_NAME=
```

Kurallar:

- Gerçek `.env` dosyası Git'e eklenmez.
- `DATABASE_URL` ve `DIRECT_URL`, `NEXT_PUBLIC_` ile başlamaz.
- `DATABASE_URL`, Vercel çalışma zamanı için Supabase pooler bağlantısıdır.
- `DIRECT_URL`, Prisma migration için doğrudan bağlantıdır.
- Gerçek secret değerleri Claude'a veya GitHub'a gönderilmez.

---

# 12. Supabase Kullanım Sınırı

Supabase üzerinde yalnızca şu özellik kullanılacaktır:

```text
PostgreSQL Database
```

Kullanılmayacak özellikler:

```text
Supabase Auth
Supabase Storage
Supabase Realtime
Supabase Frontend SDK
Supabase otomatik kullanıcı yönetimi
```

Prisma, Supabase PostgreSQL'e standart PostgreSQL bağlantısı üzerinden bağlanacaktır.

---

# 13. Yerel Kurulum ve CLI Akışı

## 13.1 Gerekli Araçlar

- Node.js LTS
- npm
- Git
- Vercel CLI
- Prisma CLI

Kurulum:

```bash
npm install -g vercel
```

Yeni proje:

```bash
npx create-next-app@latest peer-review-system
cd peer-review-system
```

Önerilen seçimler:

```text
TypeScript: Yes
ESLint: Yes
Tailwind CSS: Yes
src directory: Tercihe bağlı
App Router: Yes
Turbopack: Yes
Import alias: @/*
```

Bağımlılıklar:

```bash
npm install @prisma/client zod bcryptjs jose nodemailer
npm install @upstash/qstash
npm install csv-parse exceljs
npm install server-only
npm install -D prisma tsx @types/nodemailer
```

Prisma kurulumu:

```bash
npx prisma init
```

Supabase bağlantı bilgileri `.env` içine eklendikten sonra:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name init
```

Veritabanı kontrolü:

```bash
npx prisma studio
```

Vercel bağlantısı:

```bash
vercel login
vercel link
```

Ortam değişkenlerini eklemek için:

```bash
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add JWT_ACCESS_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_USER
vercel env add SMTP_PASSWORD
vercel env add SMTP_FROM
vercel env add QSTASH_TOKEN
vercel env add QSTASH_CURRENT_SIGNING_KEY
vercel env add QSTASH_NEXT_SIGNING_KEY
vercel env add CRON_SECRET
```

Vercel'e production deploy:

```bash
vercel --prod
```

Production migration:

```bash
npx prisma migrate deploy
```

---

# 14. Alan Adını Vercel'e Bağlama

Alan adı Vercel projesine bağlanacaktır. Ayrı bir API alan adı zorunlu değildir.

Vercel CLI:

```bash
vercel domains add alanadiniz.com
```

Vercel'in gösterdiği DNS kayıtları alan adının satın alındığı firmanın DNS paneline girilir.

Önerilen adresler:

```text
alanadiniz.com
www.alanadiniz.com
```

API endpoint'leri aynı alan adında çalışır:

```text
https://alanadiniz.com/api/auth/login
https://alanadiniz.com/api/assignments
```

---

# 15. E-posta ve Zamanlanmış İş Akışı

## 15.1 Davet E-postası

```text
Öğretmen CSV yükler
→ White-list kayıtları oluşturulur
→ Her yeni kayıt için QStash görevi oluşturulur
→ /api/jobs/send-email çağrılır
→ Nodemailer e-postayı gönderir
→ NotificationLog güncellenir
```

## 15.2 Akran Atama

```text
Teslim süresi biter
→ Vercel Cron durum kontrol endpoint'ini çağırır
→ Atama işlemi başlatılır
→ PeerAssignment kayıtları oluşturulur
→ Öğrencilere QStash üzerinden e-posta görevi gönderilir
```

## 15.3 Teslim Hatırlatma

```text
Cron periyodik çalışır
→ 24 saat içinde bitecek ödevleri bulur
→ Teslim yapmayan öğrencileri bulur
→ Daha önce gönderilmemiş reminder jobKey üretir
→ QStash üzerinden e-posta gönderir
```

## 15.4 Değerlendirme Hatırlatma

```text
Cron periyodik çalışır
→ 12 saat içinde bitecek değerlendirmeleri bulur
→ Eksik görevleri bulur
→ Tekrarsız reminder jobKey üretir
→ QStash üzerinden e-posta gönderir
```

## 15.5 Idempotency

Her zamanlanmış iş için benzersiz anahtar oluşturulmalıdır.

Örnek:

```text
submission-reminder:{assignmentId}:{userId}:24h
review-reminder:{peerAssignmentId}:12h
invitation:{whitelistEntryId}
peer-assignment:{peerAssignmentId}
student-report:{assignmentId}:{userId}
```

Bu değer `NotificationLog.jobKey` alanında unique tutulmalıdır.

---

# 16. Akran Eşleştirme Algoritması

Algoritma aşağıdaki kurallara uymalıdır:

1. Teslim yapan öğrencileri al.
2. Her öğrencinin kendi teslimini aday listesinden çıkar.
3. Teslimleri değerlendirme sayısına göre sırala.
4. Her öğrenci için en az değerlendirme almış uygun iki teslimi seç.
5. Aynı öğrenciye aynı teslimi tekrar verme.
6. Atamaları transaction içinde oluştur.
7. Yeterli eşleşme yoksa transaction'ı geri al ve öğretmene uyarı göster.
8. Aynı ödev için işlem yeniden çalıştırılırsa mevcut kayıtları tanı ve mükerrer kayıt oluşturma.

Küçük sınıflar için özel durumlar:

- 1 teslim: Akran değerlendirme yapılamaz.
- 2 teslim: Her öğrenci yalnızca diğer öğrencinin teslimini değerlendirebilir; iki farklı teslim atanamaz.
- 3 teslim: Her öğrenci diğer iki teslimi değerlendirebilir.
- 4 ve üzeri: Dengeli iki atama yapılabilir.

Öğretmen arayüzünde yetersiz öğrenci sayısı açıkça gösterilmelidir.

---

# 17. CSV Import Formatı

Önerilen CSV:

```csv
email,name,role
ogrenci1@example.com,Öğrenci Bir,STUDENT
ogrenci2@example.com,Öğrenci İki,STUDENT
```

Zorunlu alan:

```text
email
```

Opsiyonel alanlar:

```text
name
role
```

Import sonucu:

```json
{
  "totalRows": 20,
  "created": 17,
  "duplicates": 2,
  "invalid": 1,
  "errors": [
    {
      "row": 5,
      "email": "hatalı-değer",
      "reason": "Geçersiz e-posta"
    }
  ]
}
```

---

# 18. Raporlama İçeriği

Excel veya CSV raporu aşağıdaki sütunları içermelidir:

```text
Ders
Modül
Ödev
Öğrenci Adı
Öğrenci E-postası
Teslim Başlığı
Teslim Durumu
Teslim Tarihi
Bağlantılar
Atanan Değerlendirme Sayısı
Tamamlanan Değerlendirme Sayısı
Kriter Adı
Puan
Kriter Ortalaması
Genel Ortalama
Başarılı Noktalar
Geliştirilmesi Gereken Alanlar
```

Öğrenci sonuç karnesi:

- Ödev adı
- Kriter bazında aldığı puanlar
- Kriter ortalamaları
- Genel ortalama
- Anonim metin geri bildirimleri
- Değerlendirme sayısı

---

# 19. Ekranlar

## 19.1 Genel

- Ana sayfa
- Giriş
- Kayıt
- Şifre sıfırlama
- Yetkisiz erişim
- Hata sayfası

## 19.2 Öğrenci

- Kontrol paneli
- Aktif ödevler
- Ödev detay sayfası
- Teslim oluşturma/düzenleme
- Ödev havuzu
- Teslim detay ve yorumlar
- Akran değerlendirme görevleri
- Rubrik formu
- Sonuçlar

## 19.3 Öğretmen

- Kontrol paneli
- White-list yönetimi
- CSV import
- Ders yönetimi
- Modül yönetimi
- Ödev yönetimi
- Rubrik tasarımı
- Teslimler
- Atama durumu
- Değerlendirme durumu
- Raporlar
- CSV/Excel export

---

# 20. Kabul Kriterleri

Proje tamamlanmış sayılmadan önce aşağıdaki maddeler çalışmalıdır:

- Öğretmen hesabı seed veya CLI script ile oluşturulabiliyor.
- White-list'te olmayan kullanıcı kayıt olamıyor.
- White-list'te olan kullanıcı kayıt olabiliyor.
- Aynı white-list kaydı ikinci kez kullanılamıyor.
- Kullanıcı JWT ile giriş yapabiliyor.
- Access ve refresh token mekanizması çalışıyor.
- Öğretmen rolü korumalı alanlara erişebiliyor.
- Öğrenci öğretmen alanlarına erişemiyor.
- Öğretmen CSV import yapabiliyor.
- Ödev oluşturulabiliyor.
- Rubrik oluşturulabiliyor.
- Öğrenci dosya yüklemeden başlık, açıklama ve bağlantılarla teslim yapabiliyor.
- Bağlantı doğrulaması çalışıyor.
- Öğrenci teslim süresi bitince teslimi değiştiremiyor.
- Yorum ve yanıt sistemi çalışıyor.
- Teslim süresi sonunda akran atamaları oluşturuluyor.
- Öğrenciye kendi teslimi atanmıyor.
- Her öğrenciye mümkün olduğunda iki farklı teslim atanıyor.
- Öğrenci rubrik üzerinden değerlendirme yapabiliyor.
- Kesin gönderilen değerlendirme kilitleniyor.
- Değerlendiren öğrenci teslim sahibine gösterilmiyor.
- E-postalar asenkron gönderiliyor.
- Hatırlatma işleri tekrar çalışsa bile mükerrer mail oluşmuyor.
- Sonuçlar CSV ve Excel olarak dışa aktarılabiliyor.
- Uygulama Vercel'e deploy edilebiliyor.
- Prisma Supabase PostgreSQL'e bağlanabiliyor.
- Production migration çalışıyor.

---

# 21. Test Gereksinimleri

## 21.1 Unit Test

- E-posta normalize etme
- Şifre hash ve karşılaştırma
- JWT üretme ve doğrulama
- URL doğrulama
- Atama algoritması
- Ortalama hesaplama
- Rol kontrolü
- Job key üretme

## 21.2 Integration Test

- White-list kayıt akışı
- Login/refresh/logout
- Ödev oluşturma
- Teslim oluşturma ve kilitleme
- Yorum oluşturma
- Akran atama
- Değerlendirme gönderme
- Rapor oluşturma

## 21.3 E2E Test

- Öğretmen CSV yükler.
- Öğrenci kayıt olur.
- Öğretmen ödev yayınlar.
- Öğrenci teslim oluşturur.
- Teslim süresi kapanır.
- Akran atamaları oluşur.
- Öğrenci iki değerlendirme yapar.
- Sonuçlar hesaplanır.
- Rapor dışa aktarılır.

---

# 22. Claude'a Verilecek Ana Geliştirme Talimatı

Aşağıdaki bölüm Claude Code'a doğrudan verilebilir.

---

## CLAUDE GÖREVİ

Sen uzman bir Full-Stack yazılım mimarı ve kıdemli Next.js geliştiricisisin.

Bu dokümanda belirtilen **Akran Değerlendirme ve Ödev Yönetim Sistemi** projesini production kalitesinde geliştir.

### Kesin teknoloji yığını

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- Prisma ORM
- Supabase PostgreSQL
- Zod
- bcrypt
- JWT access ve refresh token
- HttpOnly cookie
- Vercel
- Vercel Cron
- Upstash QStash
- Nodemailer
- CSV import
- Excel export

### Kesin mimari kuralları

1. Supabase'i yalnızca PostgreSQL veritabanı olarak kullan.
2. Supabase Auth kullanma.
3. Supabase Storage kullanma.
4. Frontend'den Supabase'e doğrudan bağlantı kurma.
5. Tüm veritabanı işlemlerini Prisma üzerinden sunucu tarafında yap.
6. Ayrı Express veya NestJS sunucusu oluşturma.
7. Backend işlemlerini Next.js Route Handlers üzerinden geliştir.
8. Ayrı `api.` alan adı gerektirme.
9. BullMQ worker oluşturma.
10. Vercel uyumlu zamanlanmış görevler için Vercel Cron kullan.
11. Asenkron e-posta işlemleri için QStash kullan.
12. Dosya yükleme özelliği ekleme.
13. Ödev teslimini yalnızca tek başlık, tek açıklama ve bir veya daha fazla bağlantı olarak geliştir.
14. Secret değerleri kaynak koda yazma.
15. Her endpoint'te authentication, authorization ve validation uygula.
16. Tüm kritik işlemlerde transaction ve idempotency kullan.

### Yapılacaklar

1. Next.js proje yapısını oluştur.
2. Prisma şemasını bu dokümana göre oluştur.
3. Migration dosyalarını hazırla.
4. Seed script oluştur.
5. İlk öğretmen hesabını oluşturacak CLI script yaz.
6. Prisma singleton oluştur.
7. JWT access ve refresh token sistemini geliştir.
8. HttpOnly cookie yönetimini geliştir.
9. White-list kayıt sistemini geliştir.
10. CSV import işlemini geliştir.
11. Öğretmen ders/modül/ödev yönetimini geliştir.
12. Rubrik oluşturma sistemini geliştir.
13. Öğrenci teslim sistemini geliştir.
14. Çoklu bağlantı desteğini geliştir.
15. Yorum ve yorum yanıt sistemini geliştir.
16. Dengeli akran atama algoritmasını geliştir.
17. Rubrik değerlendirme sistemini geliştir.
18. QStash e-posta iş akışını geliştir.
19. Vercel Cron endpoint'lerini geliştir.
20. CSV ve Excel raporlamasını geliştir.
21. Öğrenci ve öğretmen panellerini geliştir.
22. Hata yönetimini merkezi hale getir.
23. Zod validation şemalarını oluştur.
24. Unit ve integration testleri ekle.
25. README ve `.env.example` dosyasını tamamla.
26. Vercel deployment'a hazır hale getir.

### Kod kalitesi

- TypeScript strict mode kullan.
- `any` kullanımından kaçın.
- Server-only kodu client bundle'a sokma.
- Repository/service ayrımını gereksiz karmaşıklık oluşturmadan uygula.
- Tekrar eden kodları yardımcı fonksiyonlara ayır.
- API cevap formatını standartlaştır.
- Hatalarda kullanıcıya secret veya stack trace gösterme.
- Tarih işlemlerini UTC olarak sakla.
- Arayüzde kullanıcı zaman dilimine dönüştür.
- Pagination uygula.
- Veritabanı indekslerini koru.
- E-posta işlemlerini idempotent yap.
- Akran atama işlemini transaction içinde yap.
- Aynı görevin ikinci çalışmasında mükerrer veri oluşturma.

### İlk çalışma sırası

1. Proje iskeleti
2. Prisma şeması
3. Migration
4. Seed ve öğretmen oluşturma scripti
5. Auth sistemi
6. White-list
7. Ders ve ödev yönetimi
8. Teslim sistemi
9. Yorumlar
10. Rubrik
11. Akran atama
12. Değerlendirme
13. E-posta işleri
14. Cron işleri
15. Raporlama
16. Paneller
17. Testler
18. Deployment dokümantasyonu

Her ana adım sonunda:

- Oluşturulan dosyaları listele.
- Çalıştırılacak terminal komutlarını yaz.
- Eklenen environment variable'ları belirt.
- Migration gerekip gerekmediğini belirt.
- Eksik veya varsayılan kabul edilen noktaları açıkla.
- Mevcut çalışan kodu bozacak toplu değişiklik yapmadan önce ilgili dosyaları incele.

---

# 23. Geliştirme Sırasında Alınmayacak Kararlar

Claude aşağıdaki değişiklikleri kendiliğinden yapmamalıdır:

- Supabase Auth eklemek
- Firebase eklemek
- Ayrı Express API oluşturmak
- Ayrı NestJS API oluşturmak
- Dosya yükleme özelliği eklemek
- Supabase Storage eklemek
- BullMQ worker eklemek
- Redis zorunluluğu eklemek
- JWT yerine üçüncü taraf auth sistemine geçmek
- Öğrenci kayıtlarını white-list dışına açmak
- Değerlendiren öğrencinin kimliğini teslim sahibine göstermek
- Veritabanı bağlantısını browser tarafına taşımak

---

# 24. Son Mimari Özeti

```text
Frontend:
Next.js App Router

Backend:
Next.js Route Handlers

Hosting:
Vercel

Alan adı:
Ana alan adı doğrudan Vercel'e bağlı

Veritabanı:
Supabase PostgreSQL

ORM:
Prisma

Kimlik doğrulama:
Özel JWT sistemi

Şifre:
bcrypt

Oturum:
Access token + refresh token

Token saklama:
HttpOnly cookie

White-list:
Kendi PostgreSQL tablomuz

Roller:
TEACHER ve STUDENT

Asenkron işler:
Upstash QStash

Zamanlanmış işler:
Vercel Cron

E-posta:
Nodemailer + SMTP

Dosya yükleme:
Yok

Ödev teslimi:
Tek başlık + tek açıklama/odak noktası + bir veya daha fazla bağlantı

Rapor:
CSV ve Excel
```

---

# 25. Güvenlik Notu

Aşağıdaki değerleri hiçbir zaman Claude sohbetine, GitHub deposuna veya genel bir belgeye açık biçimde ekleme:

- Supabase veritabanı şifresi
- `DATABASE_URL`
- `DIRECT_URL`
- JWT secret değerleri
- SMTP şifresi
- QStash token'ı
- Vercel token'ı
- SSH private key
- Gerçek kullanıcı şifreleri

Bu değerler yalnızca yerel `.env` dosyasında ve Vercel Environment Variables alanında tutulmalıdır.
