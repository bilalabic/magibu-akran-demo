"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, apiPost } from "@/lib/api/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geçersiz Bağlantı</CardTitle>
          <CardDescription>
            Şifre sıfırlama bağlantısı eksik veya hatalı. Lütfen e-postanızdaki
            bağlantıyı kullanın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/forgot-password">Yeni Bağlantı İste</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== passwordAgain) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/api/auth/reset-password", { token, password });
      toast.success("Şifreniz güncellendi. Giriş yapabilirsiniz.");
      router.push("/login");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Şifre güncellenemedi.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni Şifre Belirle</CardTitle>
        <CardDescription>Hesabınız için yeni bir şifre oluşturun.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Yeni şifre (en az 8 karakter)</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passwordAgain">Yeni şifre (tekrar)</Label>
            <Input
              id="passwordAgain"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={passwordAgain}
              onChange={(e) => setPasswordAgain(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Güncelleniyor…" : "Şifreyi Güncelle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
