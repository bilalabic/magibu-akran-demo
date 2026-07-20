"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { ApiClientError, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";

type CourseItem = { id: string; name: string };
type CourseDetail = {
  course: { modules: Array<{ id: string; title: string; order: number }> };
};

// datetime-local değerini ISO'ya çevirir (yerel dilim → UTC).
function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const courses = useApi<{ courses: CourseItem[] }>("/api/courses");
  const [courseId, setCourseId] = useState("");
  const courseDetail = useApi<CourseDetail>(courseId ? `/api/courses/${courseId}` : null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkRules, setLinkRules] = useState("");
  const [moduleId, setModuleId] = useState<string>("none");
  const [requiredReviewCount, setRequiredReviewCount] = useState("2");
  const [submissionStartsAt, setSubmissionStartsAt] = useState("");
  const [submissionEndsAt, setSubmissionEndsAt] = useState("");
  const [reviewStartsAt, setReviewStartsAt] = useState("");
  const [reviewEndsAt, setReviewEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  const modules = useMemo(
    () => courseDetail.data?.course.modules ?? [],
    [courseDetail.data],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const dates = {
      submissionStartsAt: toIso(submissionStartsAt),
      submissionEndsAt: toIso(submissionEndsAt),
      reviewStartsAt: toIso(reviewStartsAt),
      reviewEndsAt: toIso(reviewEndsAt),
    };
    if (Object.values(dates).some((d) => d === null)) {
      toast.error("Tüm tarihleri doldurun.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiPost<{ assignment: { id: string } }>(
        "/api/teacher/assignments",
        {
          title: title.trim(),
          description: description.trim(),
          ...(linkRules.trim() ? { linkRules: linkRules.trim() } : {}),
          courseId,
          moduleId: moduleId === "none" ? null : moduleId,
          requiredReviewCount: Number(requiredReviewCount),
          ...dates,
        },
      );
      toast.success("Ödev taslak olarak oluşturuldu. Varsayılan rubrik eklendi.");
      router.push(`/teacher/assignments/${data.assignment.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && Array.isArray(err.details)) {
        const first = err.details[0] as { message?: string } | undefined;
        toast.error(first?.message ?? err.message);
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "Ödev oluşturulamadı.");
      }
      setBusy(false);
    }
  }

  if (courses.loading) return <LoadingBox rows={3} />;
  if (courses.error) return <ErrorBox message={courses.error} />;

  if ((courses.data?.courses.length ?? 0) === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Yeni Ödev</h1>
        <ErrorBox message="Önce bir ders oluşturmalısınız. Dersler sayfasından yeni ders ekleyin." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Yeni Ödev</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ödev Bilgileri</CardTitle>
          <CardDescription>
            Ödev taslak olarak oluşturulur; rubriği düzenledikten sonra
            yayınlayabilirsiniz. Varsayılan rubrik otomatik eklenir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Ders</Label>
                <Select
                  value={courseId}
                  onValueChange={(v) => {
                    setCourseId(v);
                    setModuleId("none");
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ders seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.data!.courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Modül (opsiyonel)</Label>
                <Select value={moduleId} onValueChange={setModuleId} disabled={!courseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Modül seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Modülsüz</SelectItem>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        #{module.order} {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="a-title">Başlık</Label>
              <Input
                id="a-title"
                required
                minLength={2}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-desc">Açıklama</Label>
              <Textarea
                id="a-desc"
                required
                minLength={10}
                maxLength={10000}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a-rules">Bağlantı kuralları (opsiyonel)</Label>
              <Textarea
                id="a-rules"
                rows={2}
                maxLength={2000}
                value={linkRules}
                onChange={(e) => setLinkRules(e.target.value)}
                placeholder="Örn. GitHub deposu ve canlı demo bağlantısı zorunludur."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="d1">Teslim başlangıcı</Label>
                <Input
                  id="d1"
                  type="datetime-local"
                  required
                  value={submissionStartsAt}
                  onChange={(e) => setSubmissionStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d2">Teslim bitişi</Label>
                <Input
                  id="d2"
                  type="datetime-local"
                  required
                  value={submissionEndsAt}
                  onChange={(e) => setSubmissionEndsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d3">Değerlendirme başlangıcı</Label>
                <Input
                  id="d3"
                  type="datetime-local"
                  required
                  value={reviewStartsAt}
                  onChange={(e) => setReviewStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d4">Değerlendirme bitişi</Label>
                <Input
                  id="d4"
                  type="datetime-local"
                  required
                  value={reviewEndsAt}
                  onChange={(e) => setReviewEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Öğrenci başına değerlendirme sayısı</Label>
              <Select value={requiredReviewCount} onValueChange={setRequiredReviewCount}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Varsayılan 2 — her öğrenciye iki farklı teslim atanır (FR-6.2).
              </p>
            </div>

            <Button type="submit" disabled={busy || !courseId}>
              {busy ? "Oluşturuluyor…" : "Taslak Oluştur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
