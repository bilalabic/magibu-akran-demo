// Açık yönlendirme (open redirect) koruması.
// `startsWith("/")` kontrolü yeterli değildir: WHATWG URL çözümleyicisi özel
// şemalarda ters eğik çizgiyi "/" gibi ele aldığından `/\evil.com` gibi bir
// değer bu kontrolü geçer ama harici host'a çözülür. Bu yüzden değeri gerçek
// base'e göre çözüp yalnızca aynı origin kaldığında path+query döndürüyoruz.
export function safeInternalPath(
  candidate: string | null | undefined,
  base: string,
  fallback = "/",
): string {
  if (!candidate) return fallback;
  try {
    const resolved = new URL(candidate, base);
    const origin = new URL(base).origin;
    if (resolved.origin !== origin) return fallback;
    const path = resolved.pathname + resolved.search + resolved.hash;
    // Ekstra güvence: sonuç mutlaka tek "/" ile başlamalı.
    return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}
