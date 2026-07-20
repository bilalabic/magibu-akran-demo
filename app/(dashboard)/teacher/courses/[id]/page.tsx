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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import { ApiClientError, apiDelete, apiFetch, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { ROLE_LABELS } from "@/lib/constants/labels";

type CourseDetail = {
  course: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    modules: Array<{ id: string; title: string; order: number; description: string | null }>;
  };
  assignments: Array<{
    id: string;
    title: string;
    status: string;
    moduleId: string | null;
  }>;
};

type MemberList = {
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    leftAt: string | null;
    user: { id: string; name: string; email: string; role: string; status: string };
  }>;
};

export default function TeacherCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const detail = useApi<CourseDetail>(`/api/courses/${id}`);
  const members = useApi<MemberList>(`/api/teacher/courses/${id}/members`);
  const [moduleTitle, setModuleTitle] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Ders düzenleme diyaloğu
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState("true");

  function openEdit() {
    if (!detail.data) return;
    setEditName(detail.data.course.name);
    setEditDescription(detail.data.course.description ?? "");
    setEditActive(detail.data.course.isActive ? "true" : "false");
    setEditOpen(true);
  }

  async function handleEditSave() {
    setBusy(true);
    try {
      await apiFetch(`/api/teacher/courses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() ? editDescription.trim() : null,
          isActive: editActive === "true",
        }),
      });
      toast.success("Ders güncellendi.");
      setEditOpen(false);
      await detail.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCourse() {
    setBusy(true);
    try {
      await apiDelete(`/api/teacher/courses/${id}`);
      toast.success("Ders ve bağlı tüm veriler silindi.");
      router.push("/teacher/courses");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Ders silinemedi.");
      setBusy(false);
    }
  }

  async function handleAddModule(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost(`/api/teacher/courses/${id}/modules`, { title: moduleTitle.trim() });
      toast.success("Modül eklendi.");
      setModuleTitle("");
      await detail.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Modül eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost(`/api/teacher/courses/${id}/members`, { email: memberEmail });
      toast.success("Üye eklendi.");
      setMemberEmail("");
      await members.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Üye eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(member: MemberList["members"][number]) {
    if (
      !window.confirm(
        `${member.user.name} (${member.user.email}) dersten çıkarılsın mı?\nTeslim ve değerlendirme geçmişi korunur; tekrar eklenebilir.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiDelete(`/api/teacher/courses/${id}/members/${member.user.id}`);
      toast.success("Öğrenci dersten çıkarıldı.");
      await members.refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Çıkarılamadı.");
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading) return <LoadingBox rows={4} />;
  if (detail.error) return <ErrorBox message={detail.error} />;
  if (!detail.data) return null;

  const { course, assignments } = detail.data;
  const activeMembers = (members.data?.members ?? []).filter((m) => m.leftAt === null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {course.name}
            {!course.isActive ? (
              <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                (Pasif)
              </span>
            ) : null}
          </h1>
          {course.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/teacher/courses">← Dersler</Link>
          </Button>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openEdit}>
                Dersi Düzenle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dersi Düzenle</DialogTitle>
                <DialogDescription>
                  Ad, açıklama ve aktiflik durumunu güncelleyebilirsiniz.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Ders adı</Label>
                  <Input
                    id="edit-name"
                    minLength={2}
                    maxLength={150}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-desc">Açıklama</Label>
                  <Textarea
                    id="edit-desc"
                    rows={3}
                    maxLength={2000}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Durum</Label>
                  <Select value={editActive} onValueChange={setEditActive}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktif</SelectItem>
                      <SelectItem value="false">Pasif</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pasif ders öğrencilerin listelerinde görünmez; yeni kayıtlar pasif
                    derse otomatik eklenmez.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
                  Vazgeç
                </Button>
                <Button onClick={handleEditSave} disabled={busy || editName.trim().length < 2}>
                  Kaydet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={busy}>
                Dersi Sil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ders kalıcı olarak silinsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{course.name}&quot; dersiyle birlikte {assignments.length} ödev ve
                  bunlara ait tüm teslimler, akran atamaları ve değerlendirmeler kalıcı
                  olarak silinir. Bu işlem geri alınamaz. Veriyi korumak istiyorsanız
                  dersi &quot;Pasif&quot; yapmayı tercih edin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteCourse}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Evet, Kalıcı Olarak Sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Modüller</CardTitle>
            <CardDescription>Haftalık veya konu bazlı gruplar (FR-3.1)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddModule} className="flex gap-2">
              <Input
                required
                minLength={2}
                maxLength={150}
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="Örn. 1. Hafta — HTML/CSS"
              />
              <Button type="submit" disabled={busy}>
                Ekle
              </Button>
            </form>
            {course.modules.length === 0 ? (
              <EmptyState title="Modül yok" />
            ) : (
              <ul className="space-y-2">
                {course.modules.map((module) => (
                  <li
                    key={module.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="mr-2 text-muted-foreground">#{module.order}</span>
                      {module.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {assignments.filter((a) => a.moduleId === module.id).length} ödev
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ödevler</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <EmptyState title="Bu derste ödev yok" />
            ) : (
              <ul className="space-y-2">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <Link
                      href={`/teacher/assignments/${assignment.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <AssignmentStatusBadge status={assignment.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Üyeler ({activeMembers.length})</CardTitle>
          <CardDescription>
            Kayıt olan öğrenciler aktif derslere otomatik eklenir; buradan manuel ekleyip
            çıkarabilirsiniz. Çıkarılan öğrencinin geçmişi korunur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddMember} className="flex gap-2">
            <Input
              type="email"
              required
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="Kayıtlı kullanıcının e-postası"
            />
            <Button type="submit" disabled={busy}>
              Üye Ekle
            </Button>
          </form>
          {members.loading ? (
            <LoadingBox rows={2} />
          ) : members.error ? (
            <ErrorBox message={members.error} />
          ) : activeMembers.length === 0 ? (
            <EmptyState title="Üye yok" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.user.name}</TableCell>
                      <TableCell>{member.user.email}</TableCell>
                      <TableCell>{ROLE_LABELS[member.role] ?? member.role}</TableCell>
                      <TableCell className="text-right">
                        {member.role !== "TEACHER" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={busy}
                            onClick={() => handleRemoveMember(member)}
                          >
                            Dersten Çıkar
                          </Button>
                        ) : null}
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
