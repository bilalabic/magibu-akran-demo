"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { DateText } from "@/components/shared/date-text";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import {
  AssignmentStatusBadge,
  SubmissionStatusBadge,
} from "@/components/shared/status-badge";
import { ApiClientError, apiDelete, apiFetch, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";

type AssignmentDetail = {
  assignment: {
    id: string;
    title: string;
    description: string;
    linkRules: string | null;
    status: string;
    submissionStartsAt: string;
    submissionEndsAt: string;
    reviewStartsAt: string;
    reviewEndsAt: string;
    requiredReviewCount: number;
    course: { id: string; name: string } | null;
    module: { title: string } | null;
    submittedCount: number;
  };
};

// UTC ISO → datetime-local input değeri (yerel saat)
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type SubmissionRow = {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
  commentCount: number;
  student?: { id: string; name: string; email: string };
};

type GenerateResult = {
  created: number;
  existing: number;
  totalSubmissions: number;
  targetPerReviewer: number;
  warnings: string[];
};

export default function TeacherAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const detail = useApi<AssignmentDetail>(`/api/assignments/${id}`);
  const submissions = useApi<{ items: SubmissionRow[] }>(
    `/api/assignments/${id}/submissions?page=1&pageSize=100`,
  );
  const [busy, setBusy] = useState(false);
  const [lastGenerate, setLastGenerate] = useState<GenerateResult | null>(null);

  // Ödev düzenleme diyaloğu
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLinkRules, setEditLinkRules] = useState("");
  const [editReviewCount, setEditReviewCount] = useState("2");
  const [editDates, setEditDates] = useState({
    submissionStartsAt: "",
    submissionEndsAt: "",
    reviewStartsAt: "",
    reviewEndsAt: "",
  });

  function openEdit() {
    const a = detail.data?.assignment;
    if (!a) return;
    setEditTitle(a.title);
    setEditDescription(a.description);
    setEditLinkRules(a.linkRules ?? "");
    setEditReviewCount(String(a.requiredReviewCount));
    setEditDates({
      submissionStartsAt: toLocalInput(a.submissionStartsAt),
      submissionEndsAt: toLocalInput(a.submissionEndsAt),
      reviewStartsAt: toLocalInput(a.reviewStartsAt),
      reviewEndsAt: toLocalInput(a.reviewEndsAt),
    });
    setEditOpen(true);
  }

  async function handleEditSave() {
    const a = detail.data?.assignment;
    if (!a) return;

    // Yalnızca değişen alanlar gönderilir: başlamış aşamaların tarihleri
    // değişmeden gönderilirse sunucu kuralı gereksiz yere tetiklenmesin.
    const body: Record<string, unknown> = {};
    if (editTitle.trim() !== a.title) body.title = editTitle.trim();
    if (editDescription.trim() !== a.description) body.description = editDescription.trim();
    if ((editLinkRules.trim() || null) !== a.linkRules) {
      body.linkRules = editLinkRules.trim() ? editLinkRules.trim() : null;
    }
    if (Number(editReviewCount) !== a.requiredReviewCount) {
      body.requiredReviewCount = Number(editReviewCount);
    }
    for (const key of [
      "submissionStartsAt",
      "submissionEndsAt",
      "reviewStartsAt",
      "reviewEndsAt",
    ] as const) {
      if (editDates[key] && editDates[key] !== toLocalInput(a[key])) {
        body[key] = new Date(editDates[key]).toISOString();
      }
    }

    if (Object.keys(body).length === 0) {
      setEditOpen(false);
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/api/teacher/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Ödev güncellendi.");
      setEditOpen(false);
      await detail.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAssignment() {
    setBusy(true);
    try {
      await apiDelete(`/api/teacher/assignments/${id}`);
      toast.success("Ödev ve bağlı tüm veriler silindi.");
      router.push("/teacher/assignments");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Ödev silinemedi.");
      setBusy(false);
    }
  }

  async function runAction(path: string, successMessage: string) {
    setBusy(true);
    try {
      await apiPost(`/api/teacher/assignments/${id}/${path}`);
      toast.success(successMessage);
      await Promise.all([detail.refetch(), submissions.refetch()]);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const result = await apiPost<GenerateResult>(
        `/api/teacher/assignments/${id}/generate-peer-assignments`,
      );
      setLastGenerate(result);
      if (result.created > 0) {
        toast.success(
          `${result.created} yeni atama oluşturuldu (hedef: öğrenci başına ${result.targetPerReviewer}).`,
        );
      } else if (result.warnings.length > 0) {
        toast.warning(result.warnings[0]);
      } else {
        toast.info("Yeni atama gerekmedi (mevcut atamalar korundu).");
      }
      await detail.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Atama başarısız.");
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading) return <LoadingBox rows={4} />;
  if (detail.error) return <ErrorBox message={detail.error} />;
  if (!detail.data) return null;

  const { assignment } = detail.data;
  const status = assignment.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {assignment.course?.name}
            {assignment.module ? ` · ${assignment.module.title}` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{assignment.title}</h1>
        </div>
        <AssignmentStatusBadge status={status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Süreç Yönetimi</CardTitle>
          <CardDescription>
            Teslim: <DateText value={assignment.submissionStartsAt} /> —{" "}
            <DateText value={assignment.submissionEndsAt} /> · Değerlendirme:{" "}
            <DateText value={assignment.reviewStartsAt} /> —{" "}
            <DateText value={assignment.reviewEndsAt} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {status === "DRAFT" ? (
              <Button
                disabled={busy}
                onClick={() => runAction("publish", "Ödev yayınlandı.")}
              >
                Yayınla
              </Button>
            ) : null}
            {status === "PUBLISHED" || status === "SUBMISSION_OPEN" ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  runAction(
                    "close-submissions",
                    "Teslimler kapatıldı ve mevcut teslimler kilitlendi.",
                  )
                }
              >
                Teslimleri Kapat
              </Button>
            ) : null}
            {status === "SUBMISSION_CLOSED" || status === "REVIEW_OPEN" ? (
              <>
                <Button disabled={busy} onClick={handleGenerate}>
                  Akran Atamalarını Başlat / Yenile
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    runAction("close-reviews", "Değerlendirme süreci kapatıldı.")
                  }
                >
                  Değerlendirmeleri Kapat
                </Button>
              </>
            ) : null}
            {status === "REVIEW_CLOSED" ? (
              <Button
                disabled={busy}
                onClick={() =>
                  runAction(
                    "complete",
                    "Ödev tamamlandı; karneler ve özet e-postaları kuyruğa alındı.",
                  )
                }
              >
                Süreci Tamamla (Karneleri Gönder)
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/teacher/assignments/${id}/rubric`}>Rubriği Düzenle</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/teacher/assignments/${id}/reports`}>Raporlar</Link>
            </Button>
            <Button variant="outline" onClick={openEdit} disabled={busy}>
              Ödevi Düzenle
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  Ödevi Sil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ödev kalıcı olarak silinsin mi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{assignment.title}&quot; ödeviyle birlikte{" "}
                    {assignment.submittedCount} teslim ve bunlara ait tüm akran
                    atamaları, değerlendirmeler ve yorumlar kalıcı olarak silinir. Bu
                    işlem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAssignment}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Evet, Kalıcı Olarak Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Ödevi Düzenle</DialogTitle>
                <DialogDescription>
                  Yayınlanmış ödevde bitiş tarihleri yalnızca uzatılabilir; başlamış
                  aşamaların başlangıç tarihleri değiştirilemez.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-title">Başlık</Label>
                  <Input
                    id="edit-title"
                    minLength={2}
                    maxLength={200}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-desc">Açıklama</Label>
                  <Textarea
                    id="edit-desc"
                    rows={4}
                    maxLength={10000}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-rules">Bağlantı kuralları (opsiyonel)</Label>
                  <Textarea
                    id="edit-rules"
                    rows={2}
                    maxLength={2000}
                    value={editLinkRules}
                    onChange={(e) => setEditLinkRules(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-count">Öğrenci başına değerlendirme sayısı</Label>
                  <Input
                    id="edit-count"
                    type="number"
                    min={1}
                    max={5}
                    className="w-24"
                    value={editReviewCount}
                    onChange={(e) => setEditReviewCount(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-ss">Teslim başlangıcı</Label>
                    <Input
                      id="edit-ss"
                      type="datetime-local"
                      value={editDates.submissionStartsAt}
                      onChange={(e) =>
                        setEditDates((d) => ({ ...d, submissionStartsAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-se">Teslim bitişi</Label>
                    <Input
                      id="edit-se"
                      type="datetime-local"
                      value={editDates.submissionEndsAt}
                      onChange={(e) =>
                        setEditDates((d) => ({ ...d, submissionEndsAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-rs">Değerlendirme başlangıcı</Label>
                    <Input
                      id="edit-rs"
                      type="datetime-local"
                      value={editDates.reviewStartsAt}
                      onChange={(e) =>
                        setEditDates((d) => ({ ...d, reviewStartsAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-re">Değerlendirme bitişi</Label>
                    <Input
                      id="edit-re"
                      type="datetime-local"
                      value={editDates.reviewEndsAt}
                      onChange={(e) =>
                        setEditDates((d) => ({ ...d, reviewEndsAt: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
                  Vazgeç
                </Button>
                <Button
                  onClick={handleEditSave}
                  disabled={busy || editTitle.trim().length < 2}
                >
                  Kaydet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {lastGenerate ? (
            <div className="rounded-lg border p-3 text-sm">
              <p>
                Atama sonucu: {lastGenerate.created} yeni, {lastGenerate.existing} mevcut
                — {lastGenerate.totalSubmissions} teslim, hedef {lastGenerate.targetPerReviewer}
                /öğrenci.
              </p>
              {lastGenerate.warnings.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-amber-600 dark:text-amber-400">
                  {lastGenerate.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teslimler ({assignment.submittedCount})</CardTitle>
          <CardDescription>Bu ödev için öğrenci teslimleri</CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.loading ? (
            <LoadingBox rows={3} />
          ) : submissions.error ? (
            <ErrorBox message={submissions.error} />
          ) : (submissions.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Henüz teslim yok" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Yorum</TableHead>
                    <TableHead className="text-right">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.data!.items.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {submission.student?.name ?? "—"}
                        <p className="text-xs font-normal text-muted-foreground">
                          {submission.student?.email}
                        </p>
                      </TableCell>
                      <TableCell>{submission.title}</TableCell>
                      <TableCell>
                        <SubmissionStatusBadge status={submission.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <DateText value={submission.submittedAt} />
                      </TableCell>
                      <TableCell>{submission.commentCount}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/teacher/submissions/${submission.id}`}>Aç</Link>
                        </Button>
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
