import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Standart API cevap formatı:
//   Başarılı: { success: true, data }
//   Hatalı:   { success: false, error: { code, message, details? } }
// Hata mesajlarında stack trace veya secret sızdırılmaz (NFR/kod kalitesi kuralı).

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BUSINESS_RULE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BUSINESS_RULE: 422,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status: STATUS_BY_CODE[code] },
  );
}

// Route handler'ları saran merkezi hata yakalayıcı.
// Kullanım: export const POST = withErrorHandling(async (req) => { ... return ok(data); });
type RouteContext<P> = { params: Promise<P> };

export function withErrorHandling<P = Record<string, never>>(
  handler: (req: Request, ctx: RouteContext<P>) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: RouteContext<P>): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return errorToResponse(error);
    }
  };
}

export function errorToResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Geçersiz istek verisi.", formatZodIssues(error));
  }
  // Bilinmeyen hata: detay sızdırma, sunucu loguna yaz.
  console.error("Beklenmeyen hata:", error);
  return fail("INTERNAL_ERROR", "Beklenmeyen bir hata oluştu.");
}

function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

// JSON body'yi güvenle okuyup Zod şemasıyla doğrular.
export async function parseJsonBody<T>(
  req: Request,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Geçerli bir JSON gövdesi gönderilmelidir.");
  }
  return schema.parse(body);
}
