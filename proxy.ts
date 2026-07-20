import { NextResponse, type NextRequest } from "next/server";

import { verifyAccessToken } from "@/lib/auth/jwt";

// Sayfa düzeyinde koruma ve rol yönlendirmesi (Next.js 16: middleware → proxy).
// Güvenlik sınırı DEĞİLDİR — her API endpoint'i kendi yetki kontrolünü yapar
// (NFR-1.4). Burada yalnızca oturumsuz kullanıcıyı login'e, yanlış rolü kendi
// paneline yönlendiririz.

const ACCESS_COOKIE = "access_token";

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/student") || pathname.startsWith("/teacher");
}

function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (isProtectedPath(pathname)) {
    if (!payload) {
      // Access token süresi dolmuş olabilir; refresh cookie'si /api/auth path'inde
      // olduğundan burada okunamaz. Refresh endpoint'i geçerli oturum varsa
      // token'ları yenileyip geri yönlendirir, yoksa login'e gönderir.
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
      return NextResponse.redirect(refreshUrl);
    }

    const expectedPrefix = payload.role === "TEACHER" ? "/teacher" : "/student";
    if (!pathname.startsWith(expectedPrefix)) {
      return NextResponse.redirect(new URL(expectedPrefix, request.url));
    }
    return NextResponse.next();
  }

  if (isAuthPage(pathname) && payload) {
    const target = payload.role === "TEACHER" ? "/teacher" : "/student";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/login", "/register"],
};
