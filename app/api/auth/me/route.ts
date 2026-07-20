import { requireAuth } from "@/lib/auth/authorization";
import { ok, withErrorHandling } from "@/lib/errors";
import { serializeUser } from "@/server/services/auth-service";

export const GET = withErrorHandling(async () => {
  const user = await requireAuth();
  return ok({ user: serializeUser(user) });
});
