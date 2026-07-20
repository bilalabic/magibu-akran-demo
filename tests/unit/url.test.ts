import { describe, expect, it } from "vitest";

import { validateSubmissionUrl } from "@/lib/validation/url";

// FR-4.7 / FR-4.8: URL doğrulama
describe("validateSubmissionUrl", () => {
  it.each([
    "https://github.com/ornek/proje",
    "http://ornek.com/sayfa?x=1&y=2",
    "https://alt.alan.ornek.dev/yol#bolum",
  ])("kabul eder: %s", (url) => {
    const result = validateSubmissionUrl(url);
    expect(result.valid).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "file:///etc/passwd",
    "ftp://ornek.com/dosya",
    "vbscript:MsgBox(1)",
  ])("protokolü reddeder: %s", (url) => {
    const result = validateSubmissionUrl(url);
    expect(result.valid).toBe(false);
  });

  it("protokolsüz adresi reddeder", () => {
    expect(validateSubmissionUrl("ornek.com/proje").valid).toBe(false);
  });

  it("boş değeri reddeder", () => {
    expect(validateSubmissionUrl("   ").valid).toBe(false);
  });

  it("aşırı uzun adresi reddeder", () => {
    const url = "https://ornek.com/" + "a".repeat(2100);
    expect(validateSubmissionUrl(url).valid).toBe(false);
  });

  it("baş/son boşlukları temizleyip kabul eder", () => {
    const result = validateSubmissionUrl("  https://ornek.com  ");
    expect(result.valid).toBe(true);
  });
});
