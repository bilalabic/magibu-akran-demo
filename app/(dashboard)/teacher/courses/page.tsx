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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { ApiClientError, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";

type CourseItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { memberships: number; assignments: number; modules: number };
};

export default function TeacherCoursesPage() {
  const { data, error, loading, refetch } = useApi<{ courses: CourseItem[] }>(
    "/api/courses",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/teacher/courses", {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.success("Ders oluşturuldu; kayıtlı öğrenciler otomatik eklendi.");
      setName("");
      setDescription("");
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Ders oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dersler</h1>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Ders</CardTitle>
          <CardDescription>
            Ders oluşturulduğunda kayıtlı tüm aktif öğrenciler otomatik üye olur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="course-name">Ders adı</Label>
              <Input
                id="course-name"
                required
                minLength={2}
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Web Programlama 2026"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="course-desc">Açıklama (opsiyonel)</Label>
              <Textarea
                id="course-desc"
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Ders Oluştur
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ders Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox rows={2} />
          ) : error ? (
            <ErrorBox message={error} />
          ) : (data?.courses.length ?? 0) === 0 ? (
            <EmptyState title="Henüz ders yok" description="Yukarıdan ilk dersi oluşturun." />
          ) : (
            <ul className="divide-y">
              {data!.courses.map((course) => (
                <li
                  key={course.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <Link
                      href={`/teacher/courses/${course.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {course.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {course._count.memberships} üye · {course._count.modules} modül ·{" "}
                      {course._count.assignments} ödev
                    </p>
                  </div>
                  <Badge variant={course.isActive ? "secondary" : "outline"}>
                    {course.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
