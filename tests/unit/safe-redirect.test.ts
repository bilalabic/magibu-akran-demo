import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/utils/safe-redirect";

const BASE = "https://app.example.com/api/auth/refresh";

// Açık yönlendirme (open redirect) koruması
describe("safeInternalPath", () => {
  it.each([
    ["/teacher", "/teacher"],
    ["/student/assignments/1?tab=pool", "/student/assignments/1?tab=pool"],
    ["/reset-password?token=abc#x", "/reset-password?token=abc#x"],
  ])("aynı origin path'ini korur: %s", (input, expected) => {
    expect(safeInternalPath(input, BASE)).toBe(expected);
  });

  it.each([
    // Ters eğik çizgi bypass'ı — WHATWG parser bunu //evil.com'a çevirir
    "/\\evil.com",
    "/\\/evil.com",
    // Protokol-göreli
    "//evil.com",
    "///evil.com",
    // Mutlak harici URL
    "https://evil.com/phish",
    "http://evil.com",
    // Şema karışıklığı
    "javascript:alert(1)",
  ])("harici/kötü hedefi fallback'e düşürür: %s", (input) => {
    expect(safeInternalPath(input, BASE)).toBe("/");
  });

  it("tab enjeksiyonu aynı origin path'ine sadeleşir (harici değil)", () => {
    // WHATWG parser tab'ı siler → /evil.com aynı origin üzerinde bir path olur.
    expect(safeInternalPath("/\tevil.com", BASE)).toBe("/evil.com");
  });

  it("boş/None değerde fallback döndürür", () => {
    expect(safeInternalPath(null, BASE)).toBe("/");
    expect(safeInternalPath(undefined, BASE)).toBe("/");
    expect(safeInternalPath("", BASE, "/login")).toBe("/login");
  });

  it("özel fallback kullanır", () => {
    expect(safeInternalPath("https://evil.com", BASE, "/teacher")).toBe("/teacher");
  });
});
