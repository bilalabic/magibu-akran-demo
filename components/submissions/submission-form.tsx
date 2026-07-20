"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiPatch, apiPost } from "@/lib/api/client";

type LinkDraft = { label: string; url: string };

export type ExistingSubmission = {
  id: string;
  title: string;
  description: string;
  status: string;
  links: Array<{ label: string | null; url: string }>;
} | null;

// FR-4.2..4.9: başlık + açıklama + en az bir bağlantı; süre bitene dek
// güncellenebilir; "Kesinleştir" DRAFT → SUBMITTED yapar.
export function SubmissionForm({
  assignmentId,
  existing,
  windowOpen,
  onSaved,
}: {
  assignmentId: string;
  existing: ExistingSubmission;
  windowOpen: boolean;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(
    existing && existing.links.length > 0
      ? existing.links.map((l) => ({ label: l.label ?? "", url: l.url }))
      : [{ label: "", url: "" }],
  );
  const [busy, setBusy] = useState(false);

  const locked = existing?.status === "LOCKED" || !windowOpen;

  function updateLink(index: number, field: keyof LinkDraft, value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function save(): Promise<boolean> {
    const payload = {
      title: title.trim(),
      description: description.trim(),
      links: links
        .filter((l) => l.url.trim())
        .map((l) => ({ label: l.label.trim() || undefined, url: l.url.trim() })),
    };
    if (payload.links.length === 0) {
      toast.error("En az bir bağlantı eklemelisiniz.");
      return false;
    }
    setBusy(true);
    try {
      if (existing) {
        await apiPatch(`/api/assignments/${assignmentId}/submission`, payload);
      } else {
        await apiPost(`/api/assignments/${assignmentId}/submission`, payload);
      }
      return true;
    } catch (error) {
      if (error instanceof ApiClientError && Array.isArray(error.details)) {
        const first = error.details[0] as { message?: string } | undefined;
        toast.error(first?.message ?? error.message);
      } else {
        toast.error(error instanceof ApiClientError ? error.message : "Kaydedilemedi.");
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (await save()) {
      toast.success(existing ? "Teslim güncellendi." : "Teslim taslağı oluşturuldu.");
      onSaved();
    }
  }

  async function handleFinalize() {
    if (!(await save())) return;
    setBusy(true);
    try {
      await apiPost(`/api/assignments/${assignmentId}/submission/submit`);
      toast.success("Teslim kesinleştirildi. Süre bitene kadar güncelleyebilirsiniz.");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Teslim kesinleştirilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <p className="text-sm text-muted-foreground">
        Teslim süresi sona erdi; teslim artık değiştirilemez.
      </p>
    );
  }

  return (
    <form onSubmit={handleSaveDraft} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sub-title">Başlık</Label>
        <Input
          id="sub-title"
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn. 1. Hafta Web Uygulaması"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sub-desc">Açıklama ve odak noktası</Label>
        <Textarea
          id="sub-desc"
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bu teslimde nelere odaklandınız? Değerlendirenler neye dikkat etmeli?"
        />
      </div>

      <div className="space-y-2">
        <Label>Bağlantılar (http/https)</Label>
        <div className="space-y-2">
          {links.map((link, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="sm:w-40"
                placeholder="Etiket (ör. GitHub)"
                maxLength={100}
                value={link.label}
                onChange={(e) => updateLink(index, "label", e.target.value)}
              />
              <Input
                className="flex-1"
                type="url"
                placeholder="https://…"
                value={link.url}
                onChange={(e) => updateLink(index, "url", e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sm:self-center"
                disabled={links.length === 1}
                onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
              >
                Kaldır
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={links.length >= 10}
          onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}
        >
          + Bağlantı Ekle
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={busy}>
          {existing ? "Güncelle" : "Taslak Kaydet"}
        </Button>
        <Button type="button" onClick={handleFinalize} disabled={busy}>
          {existing?.status === "SUBMITTED" ? "Güncelle ve Teslim Et" : "Teslim Et"}
        </Button>
      </div>
      {existing?.status === "SUBMITTED" ? (
        <p className="text-xs text-muted-foreground">
          Tesliminiz alındı. Süre bitene kadar güncelleme yapabilirsiniz.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          &quot;Teslim Et&quot; demeden yalnızca taslak olarak kalır ve
          değerlendirmeye dahil edilmez.
        </p>
      )}
    </form>
  );
}
