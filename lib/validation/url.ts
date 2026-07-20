// FR-4.7 / FR-4.8: Teslim bağlantıları yalnızca http/https olabilir;
// javascript:, data:, file: ve benzeri protokoller reddedilir.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
export const MAX_URL_LENGTH = 2048;

export type UrlValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; reason: string };

export function validateSubmissionUrl(rawUrl: string): UrlValidationResult {
  const value = rawUrl.trim();
  if (!value) {
    return { valid: false, reason: "Bağlantı boş olamaz." };
  }
  if (value.length > MAX_URL_LENGTH) {
    return { valid: false, reason: `Bağlantı en fazla ${MAX_URL_LENGTH} karakter olabilir.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      valid: false,
      reason: "Geçersiz bağlantı. Adres http:// veya https:// ile başlamalıdır.",
    };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      valid: false,
      reason: `"${parsed.protocol.replace(":", "")}" protokolüne izin verilmiyor. Yalnızca http ve https kullanılabilir.`,
    };
  }
  if (!parsed.hostname) {
    return { valid: false, reason: "Bağlantıda alan adı bulunamadı." };
  }

  return { valid: true, normalized: parsed.toString() };
}
