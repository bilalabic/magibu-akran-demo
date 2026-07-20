// FR-1.3: E-posta adresleri kayıt/giriş öncesi küçük harfe çevrilir ve boşluklardan temizlenir.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Basit ama pratik e-posta biçim kontrolü (CSV import satır doğrulamasında da kullanılır).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}
