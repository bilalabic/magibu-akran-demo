import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

// FR-1.6 / NFR-1.1: bcrypt hash ve karşılaştırma
describe("password hashing", () => {
  it("şifreyi hashler ve doğrular", async () => {
    const hash = await hashPassword("GizliSifre123!");
    expect(hash).not.toBe("GizliSifre123!");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("GizliSifre123!", hash)).toBe(true);
  });

  it("yanlış şifreyi reddeder", async () => {
    const hash = await hashPassword("DogruSifre123!");
    expect(await verifyPassword("YanlisSifre123!", hash)).toBe(false);
  });

  it("aynı şifre için farklı salt ile farklı hash üretir", async () => {
    const first = await hashPassword("AyniSifre123!");
    const second = await hashPassword("AyniSifre123!");
    expect(first).not.toBe(second);
  });
});
