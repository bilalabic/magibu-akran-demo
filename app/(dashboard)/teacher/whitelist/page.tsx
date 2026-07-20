"use client";

import { useRef, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateText } from "@/components/shared/date-text";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { WhitelistStatusBadge } from "@/components/shared/status-badge";
import { ApiClientError, apiDelete, apiFetch, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";

type WhitelistEntry = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invitedAt: string | null;
  registeredAt: string | null;
  createdAt: string;
  user: { id: string; name: string; lastLoginAt: string | null } | null;
};

type ImportResult = {
  totalRows: number;
  created: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

// FR-2: White-list yönetimi — manuel ekleme, CSV import, iptal, davet.
export default function TeacherWhitelistPage() {
  const { data, error, loading, refetch } = useApi<{ items: WhitelistEntry[] }>(
    "/api/teacher/whitelist?page=1&pageSize=100",
  );
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/teacher/whitelist", {
        email: newEmail,
        ...(newName.trim() ? { name: newName.trim() } : {}),
      });
      toast.success("Öğrenci eklendi; davet e-postası kuyruğa alındı.");
      setNewEmail("");
      setNewName("");
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiFetch<ImportResult>("/api/teacher/whitelist/import", {
        method: "POST",
        body: formData,
      });
      setImportResult(result);
      toast.success(
        `Import tamamlandı: ${result.created} eklendi, ${result.duplicates} mükerrer, ${result.invalid} hatalı.`,
      );
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Import başarısız.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRevoke(entry: WhitelistEntry) {
    if (!window.confirm(`${entry.email} kaydını iptal etmek istiyor musunuz?`)) return;
    setBusy(true);
    try {
      await apiDelete(`/api/teacher/whitelist/${entry.id}`);
      toast.success("Kayıt iptal edildi.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "İptal edilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend(entry: WhitelistEntry) {
    setBusy(true);
    try {
      await apiPost(`/api/teacher/whitelist/${entry.id}/send-invitation`);
      toast.success("Davet e-postası kuyruğa alındı.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Davet gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(entry: WhitelistEntry) {
    setBusy(true);
    try {
      await apiFetch(`/api/teacher/whitelist/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PENDING" }),
      });
      toast.success("Kayıt yeniden aktifleştirildi.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">White-list Yönetimi</h1>

      <Card>
        <CardHeader>
          <CardTitle>Öğrenci Ekle</CardTitle>
          <CardDescription>
            Yalnızca buraya eklenen e-posta adresleri sisteme kayıt olabilir (FR-1.2).
            Eklenen öğrenciye otomatik davet e-postası gönderilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual">
            <TabsList>
              <TabsTrigger value="manual">Tek Tek Ekle</TabsTrigger>
              <TabsTrigger value="csv">CSV / Excel ile Toplu Ekle</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-4">
              <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="wl-email">E-posta</Label>
                  <Input
                    id="wl-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ogrenci@ornek.com"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="wl-name">Ad Soyad (opsiyonel)</Label>
                  <Input
                    id="wl-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <Button type="submit" className="sm:self-end" disabled={busy}>
                  Ekle ve Davet Et
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="csv" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                CSV (<code>.csv</code>) veya Excel (<code>.xlsx</code>) yükleyebilirsiniz.
                İlk satır başlık olmalı: <code>email</code> zorunlu, <code>name</code> ve{" "}
                <code>role</code> opsiyonel (Türkçe başlıklar da olur: e-posta, ad, rol).
                CSV dosyasında ayraç virgül veya noktalı virgül olabilir. Örnek:
              </p>
              <pre className="rounded-lg bg-muted p-3 text-xs">
                {"email,name,role\nogrenci1@ornek.com,Ayşe Yılmaz,STUDENT\nogrenci2@ornek.com,,"}
              </pre>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImport(file);
                }}
              />
              {importResult ? (
                <div className="rounded-lg border p-3 text-sm">
                  <p>
                    Toplam {importResult.totalRows} satır — {importResult.created}{" "}
                    eklendi, {importResult.duplicates} mükerrer, {importResult.invalid}{" "}
                    hatalı.
                  </p>
                  {importResult.errors.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          Satır {err.row}: {err.email || "(boş)"} — {err.reason}
                        </li>
                      ))}
                      {importResult.errors.length > 10 ? (
                        <li>… ve {importResult.errors.length - 10} hata daha</li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox rows={4} />
          ) : error ? (
            <ErrorBox message={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState title="White-list boş" description="Yukarıdan öğrenci ekleyin." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Davet</TableHead>
                    <TableHead>Kayıt</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.email}</TableCell>
                      <TableCell>{entry.user?.name ?? entry.name ?? "—"}</TableCell>
                      <TableCell>
                        <WhitelistStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <DateText value={entry.invitedAt} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <DateText value={entry.registeredAt} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {entry.status === "PENDING" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => handleResend(entry)}
                              >
                                Davet Gönder
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                disabled={busy}
                                onClick={() => handleRevoke(entry)}
                              >
                                İptal
                              </Button>
                            </>
                          ) : null}
                          {entry.status === "REVOKED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => handleRestore(entry)}
                            >
                              Yeniden Aktifleştir
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
