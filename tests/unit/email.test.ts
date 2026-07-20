import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "@/lib/utils/email";

// FR-1.3: E-posta normalize etme
describe("normalizeEmail", () => {
  it("küçük harfe çevirir ve boşlukları temizler", () => {
    expect(normalizeEmail("  Ogrenci@Ornek.COM  ")).toBe("ogrenci@ornek.com");
  });

  it("zaten normal olan adresi değiştirmez", () => {
    expect(normalizeEmail("a@b.co")).toBe("a@b.co");
  });
});

describe("isValidEmail", () => {
  it.each(["ogrenci@ornek.com", "a.b+tag@sub.domain.org", "X@Y.ZZ"])(
    "geçerli kabul eder: %s",
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each(["", "duz-metin", "@ornek.com", "a@b", "a b@c.com", "a@b c.com"])(
    "geçersiz kabul eder: %s",
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );

  it("254 karakterden uzun adresi reddeder", () => {
    const local = "a".repeat(250);
    expect(isValidEmail(`${local}@b.com`)).toBe(false);
  });
});
