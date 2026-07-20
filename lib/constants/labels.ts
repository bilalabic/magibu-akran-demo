// Enum → Türkçe etiket eşlemeleri (UI genelinde tek kaynak).

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  SUBMISSION_OPEN: "Teslim Açık",
  SUBMISSION_CLOSED: "Teslim Kapandı",
  REVIEW_OPEN: "Değerlendirme Açık",
  REVIEW_CLOSED: "Değerlendirme Kapandı",
  COMPLETED: "Tamamlandı",
  ARCHIVED: "Arşivlendi",
};

export const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  SUBMISSION_OPEN: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  SUBMISSION_CLOSED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  REVIEW_OPEN: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  REVIEW_CLOSED: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Teslim Edildi",
  LOCKED: "Kilitli",
};

export const PEER_ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Atandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  EXPIRED: "Süresi Doldu",
};

export const WHITELIST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  REGISTERED: "Kayıt Oldu",
  REVOKED: "İptal Edildi",
};

export const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Öğretmen",
  STUDENT: "Öğrenci",
};
