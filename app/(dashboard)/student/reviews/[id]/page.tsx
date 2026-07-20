"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateText } from "@/components/shared/date-text";
import { ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { PeerAssignmentStatusBadge } from "@/components/shared/status-badge";
import { LinkList } from "@/components/submissions/link-list";
import { ApiClientError, apiPatch, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";

type ReviewDetail = {
  peerAssignment: {
    id: string;
    status: string;
    expiresAt: string;
    assignment: { id: string; title: string; reviewEndsAt: string };
    submission: {
      id: string;
      title: string;
      description: string;
      links: Array<{ id: string; label: string | null; url: string }>;
    };
    review: {
      id: string;
      status: string;
      submittedAt: string | null;
      answers: Array<{ criterionId: string; score: number | null; textValue: string | null }>;
    } | null;
  };
  rubric: {
    title: string;
    criteria: Array<{
      id: string;
      title: string;
      description: string | null;
      type: "SCORE" | "TEXT";
      required: boolean;
      minScore: number | null;
      maxScore: number | null;
    }>;
  } | null;
};

type AnswerState = Record<string, { score: number | null; textValue: string }>;

// FR-7.7/7.8: rubrik formu — taslak kaydet + kesin gönder (onaylı).
export default function StudentReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, loading, refetch } = useApi<ReviewDetail>(
    `/api/peer-assignments/${id}`,
  );
  const [answers, setAnswers] = useState<AnswerState>({});
  const [busy, setBusy] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  // Veri geldiğinde form durumunu render sırasında ayarla (adjust-state pattern).
  const [initializedFor, setInitializedFor] = useState<ReviewDetail | null>(null);
  if (data && data !== initializedFor) {
    setInitializedFor(data);
    const initial: AnswerState = {};
    for (const criterion of data.rubric?.criteria ?? []) {
      const existing = data.peerAssignment.review?.answers.find(
        (a) => a.criterionId === criterion.id,
      );
      initial[criterion.id] = {
        score: existing?.score ?? null,
        textValue: existing?.textValue ?? "",
      };
    }
    setAnswers(initial);
  }

  if (loading) return <LoadingBox rows={4} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { peerAssignment, rubric } = data;
  const submitted = peerAssignment.review?.status === "SUBMITTED";
  const expired =
    peerAssignment.status === "EXPIRED" ||
    new Date(peerAssignment.assignment.reviewEndsAt).getTime() <= mountedAt;
  const readOnly = submitted || expired;

  function buildPayload() {
    return {
      answers: Object.entries(answers).map(([criterionId, value]) => ({
        criterionId,
        score: value.score,
        textValue: value.textValue.trim() ? value.textValue.trim() : null,
      })),
    };
  }

  async function handleSaveDraft() {
    setBusy(true);
    try {
      await apiPatch(`/api/peer-assignments/${id}/review`, buildPayload());
      toast.success("Taslak kaydedildi.");
      await refetch();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      await apiPost(`/api/peer-assignments/${id}/review/submit`, buildPayload());
      toast.success("Değerlendirme gönderildi. Teşekkürler!");
      router.push("/student/reviews");
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  function showError(err: unknown) {
    if (err instanceof ApiClientError && Array.isArray(err.details)) {
      for (const detail of (err.details as string[]).slice(0, 3)) {
        toast.error(String(detail));
      }
    } else {
      toast.error(err instanceof ApiClientError ? err.message : "İşlem başarısız.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {peerAssignment.assignment.title} · Anonim akran değerlendirmesi
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {peerAssignment.submission.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Son tarih: <DateText value={peerAssignment.assignment.reviewEndsAt} />
          </p>
        </div>
        <PeerAssignmentStatusBadge status={peerAssignment.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Değerlendirilecek Teslim</CardTitle>
          <CardDescription>
            Teslim sahibinin kimliği gizlidir; yalnızca içeriği değerlendirin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">
            {peerAssignment.submission.description}
          </p>
          <div>
            <p className="mb-1 text-sm font-medium">Bağlantılar</p>
            <LinkList links={peerAssignment.submission.links} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{rubric?.title ?? "Değerlendirme"}</CardTitle>
          <CardDescription>
            {readOnly
              ? submitted
                ? "Bu değerlendirme kesin gönderildi ve değiştirilemez."
                : "Değerlendirme süresi doldu."
              : "Tüm zorunlu kriterleri doldurup gönderin. Göndermeden önce taslak olarak kaydedebilirsiniz."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(rubric?.criteria ?? []).map((criterion) => {
            const value = answers[criterion.id] ?? { score: null, textValue: "" };
            return (
              <div key={criterion.id} className="space-y-2">
                <Label>
                  {criterion.title}
                  {criterion.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {criterion.description ? (
                  <p className="text-xs text-muted-foreground">{criterion.description}</p>
                ) : null}
                {criterion.type === "SCORE" ? (
                  <Select
                    disabled={readOnly}
                    value={value.score === null ? "" : String(value.score)}
                    onValueChange={(v) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [criterion.id]: { ...value, score: Number(v) },
                      }))
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue
                        placeholder={`Puan (${criterion.minScore ?? 1}-${criterion.maxScore ?? 10})`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: (criterion.maxScore ?? 10) - (criterion.minScore ?? 1) + 1 },
                        (_, i) => (criterion.minScore ?? 1) + i,
                      ).map((score) => (
                        <SelectItem key={score} value={String(score)}>
                          {score}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Textarea
                    disabled={readOnly}
                    rows={3}
                    maxLength={5000}
                    value={value.textValue}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [criterion.id]: { ...value, textValue: e.target.value },
                      }))
                    }
                    placeholder="Yapıcı ve saygılı geri bildirim yazın…"
                  />
                )}
              </div>
            );
          })}

          {!readOnly ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
                Taslak Kaydet
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={busy}>Kesin Gönder</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Değerlendirmeyi gönder?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Kesin gönderilen değerlendirme bir daha değiştirilemez. Devam
                      etmek istiyor musunuz?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>
                      Evet, Gönder
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
