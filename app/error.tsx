"use client";

import { Button } from "@/components/ui/button";

// Genel hata sayfası — kullanıcıya stack trace/secret gösterilmez.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Bir şeyler ters gitti</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Beklenmeyen bir hata oluştu. Sorun devam ederse öğretmeninize bildirin.
      </p>
      <Button onClick={reset}>Tekrar Dene</Button>
    </div>
  );
}
