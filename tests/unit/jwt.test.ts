import { describe, expect, it } from "vitest";

import {
  durationToSeconds,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";

// FR-1.7: JWT üretme ve doğrulama
describe("jwt", () => {
  it("access token üretir ve doğrular", async () => {
    const token = await signAccessToken("user-1", "STUDENT");
    const payload = await verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-1");
    expect(payload!.role).toBe("STUDENT");
    expect(payload!.type).toBe("access");
  });

  it("refresh token üretir ve doğrular (jti içerir)", async () => {
    const token = await signRefreshToken("user-2", "TEACHER");
    const payload = await verifyRefreshToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-2");
    expect(payload!.jti).toBeTruthy();
  });

  it("access token'ı refresh doğrulayıcısı kabul etmez (ayrı secretlar)", async () => {
    const access = await signAccessToken("user-3", "STUDENT");
    expect(await verifyRefreshToken(access)).toBeNull();
  });

  it("refresh token'ı access doğrulayıcısı kabul etmez", async () => {
    const refresh = await signRefreshToken("user-4", "STUDENT");
    expect(await verifyAccessToken(refresh)).toBeNull();
  });

  it("bozuk token'ı reddeder", async () => {
    expect(await verifyAccessToken("bozuk.token.degeri")).toBeNull();
  });

  it("her refresh token benzersizdir (rotation için)", async () => {
    const first = await signRefreshToken("user-5", "STUDENT");
    const second = await signRefreshToken("user-5", "STUDENT");
    expect(first).not.toBe(second);
  });
});

describe("durationToSeconds", () => {
  it.each([
    ["15m", 900],
    ["7d", 604800],
    ["12h", 43200],
    ["45s", 45],
    ["900", 900],
  ] as const)("%s → %d saniye", (input, expected) => {
    expect(durationToSeconds(input)).toBe(expected);
  });

  it("geçersiz biçimde hata fırlatır", () => {
    expect(() => durationToSeconds("abc")).toThrow();
  });
});
