"use client";

import Link from "next/link";
import { use, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { ApiClientError, apiPut } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";

type CriterionDraft = {
  title: string;
  description: string;
  type: "SCORE" | "TEXT";
  required: boolean;
  minScore: number;
  maxScore: number;
};

type RubricData = {
  rubric: {
    title: string;
    description: string | null;
    criteria: Array<{
      title: string;
      description: string | null;
      type: "SCORE" | "TEXT";
      required: boolean;
      minScore: number | null;
      maxScore: number | null;
    }>;
  } | null;
};

// FR-7.1/7.2: Rubrik tasarımı — sayısal (1-10) ve metin kriterleri.
export default function RubricEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading } = useApi<RubricData>(
    `/api/teacher/assignments/${id}/rubric`,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [busy, setBusy] = useState(false);

  // Veri geldiğinde form durumunu render sırasında ayarla (adjust-state pattern).
  const [initializedFor, setInitializedFor] = useState<RubricData | null>(null);
  if (data && data !== initializedFor) {
    setInitializedFor(data);
    if (data.rubric) {
      setTitle(data.rubric.title);
      setDescription(data.rubric.description ?? "");
      setCriteria(
        data.rubric.criteria.map((c) => ({
          title: c.title,
          description: c.description ?? "",
          type: c.type,
          required: c.required,
          minScore: c.minScore ?? 1,
          maxScore: c.maxScore ?? 10,
        })),
      );
    }
  }

  function updateCriterion(index: number, patch: Partial<CriterionDraft>) {
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function moveCriterion(index: number, direction: -1 | 1) {
    setCriteria((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function handleSave() {
    if (criteria.length === 0) {
      toast.error("En az bir kriter gerekli.");
      return;
    }
    setBusy(true);
    try {
      await apiPut(`/api/teacher/assignments/${id}/rubric`, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        criteria: criteria.map((c) => ({
          title: c.title.trim(),
          description: c.description.trim() ? c.description.trim() : null,
          type: c.type,
          required: c.required,
          minScore: c.type === "SCORE" ? c.minScore : null,
          maxScore: c.type === "SCORE" ? c.maxScore : null,
        })),
      });
      toast.success("Rubrik kaydedildi.");
    } catch (err) {
      if (err instanceof ApiClientError && Array.isArray(err.details)) {
        const first = err.details[0] as { message?: string } | undefined;
        toast.error(first?.message ?? err.message);
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "Kaydedilemedi.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBox rows={4} />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Rubrik Tasarımı</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={`/teacher/assignments/${id}`}>← Ödeve Dön</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rubrik Bilgileri</CardTitle>
          <CardDescription>
            Değerlendirmeler başladıktan sonra rubrik değiştirilemez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="r-title">Rubrik başlığı</Label>
            <Input
              id="r-title"
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-desc">Açıklama (opsiyonel)</Label>
            <Textarea
              id="r-desc"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kriterler ({criteria.length})</CardTitle>
          <CardDescription>
            Sayısal kriterlerde varsayılan puan aralığı 1-10&apos;dur (FR-7.4).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteria.map((criterion, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Kriter {index + 1}
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => moveCriterion(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === criteria.length - 1}
                    onClick={() => moveCriterion(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={criteria.length === 1}
                    onClick={() =>
                      setCriteria((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    Kaldır
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Başlık</Label>
                  <Input
                    required
                    minLength={2}
                    maxLength={200}
                    value={criterion.title}
                    onChange={(e) => updateCriterion(index, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tür</Label>
                  <Select
                    value={criterion.type}
                    onValueChange={(v) =>
                      updateCriterion(index, { type: v as "SCORE" | "TEXT" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCORE">Sayısal Puan</SelectItem>
                      <SelectItem value="TEXT">Metin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Açıklama (opsiyonel)</Label>
                <Input
                  maxLength={1000}
                  value={criterion.description}
                  onChange={(e) => updateCriterion(index, { description: e.target.value })}
                />
              </div>
              {criterion.type === "SCORE" ? (
                <div className="flex gap-3">
                  <div className="space-y-1">
                    <Label>Min puan</Label>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      className="w-24"
                      value={criterion.minScore}
                      onChange={(e) =>
                        updateCriterion(index, { minScore: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Max puan</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-24"
                      value={criterion.maxScore}
                      onChange={(e) =>
                        updateCriterion(index, { maxScore: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={criterion.required}
                  onChange={(e) => updateCriterion(index, { required: e.target.checked })}
                />
                Zorunlu kriter
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={criteria.length >= 20}
              onClick={() =>
                setCriteria((prev) => [
                  ...prev,
                  {
                    title: "",
                    description: "",
                    type: "SCORE",
                    required: true,
                    minScore: 1,
                    maxScore: 10,
                  },
                ])
              }
            >
              + Kriter Ekle
            </Button>
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? "Kaydediliyor…" : "Rubriği Kaydet"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
