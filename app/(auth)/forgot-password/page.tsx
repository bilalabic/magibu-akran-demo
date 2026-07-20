"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiPost("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "İşlem gerçekleştirilemedi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifremi Unuttum</CardTitle>
        <CardDescription>
          E-posta adresinizi girin; kayıtlıysa şifre sıfırlama bağlantısı gönderelim.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-sm">
            <p>
              Bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.
              Gelen kutunuzu (ve spam klasörünü) kontrol edin.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Girişe Dön</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="underline underline-offset-4">
                Girişe dön
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
