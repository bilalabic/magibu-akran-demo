import { clearAuthCookies, readRefreshToken } from "@/lib/auth/cookies";
import { revokeSessionByToken } from "@/lib/auth/session";
import { ok, withErrorHandling } from "@/lib/errors";

// NFR-1.10: Çıkışta ilgili oturum iptal edilir ve cookie'ler temizlenir.
export const POST = withErrorHandling(async () => {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    await revokeSessionByToken(refreshToken);
  }
  await clearAuthCookies();
  return ok({ loggedOut: true });
});
