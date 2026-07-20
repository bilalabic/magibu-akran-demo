import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/authorization";

export default async function HomePage() {
  const user = await getAuthUser();
  if (user) {
    redirect(user.role === "TEACHER" ? "/teacher" : "/student");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-semibold tracking-tight">Akran Değerlendirme</span>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Giriş Yap</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Kayıt Ol</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Akran Değerlendirme ve Ödev Yönetim Sistemi
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Ödevlerinizi bağlantılarla teslim edin, arkadaşlarınızın çalışmalarını
            rubrik üzerinden değerlendirin, sonuçlarınızı ve anonim geri
            bildirimlerinizi tek yerden takip edin.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">Giriş Yap</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">Davetliyim, Kayıt Ol</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Kayıt yalnızca öğretmeniniz tarafından davet edilen e-posta adresleriyle
            yapılabilir.
          </p>
        </div>
      </main>
    </div>
  );
}
