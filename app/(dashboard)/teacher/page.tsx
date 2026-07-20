"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateText } from "@/components/shared/date-text";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import { useApi } from "@/lib/api/use-api";

type AssignmentListItem = {
  id: string;
  title: string;
  status: string;
  submissionEndsAt: string;
  reviewEndsAt: string;
  course: { name: string };
  _count: { submissions: number; peerAssignments: number };
};

type WhitelistData = {
  items: Array<{ id: string; status: string }>;
  pagination: { total: number };
};

export default function TeacherDashboardPage() {
  const assignments = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=50",
  );
  const whitelist = useApi<WhitelistData>("/api/teacher/whitelist?page=1&pageSize=100");
  const courses = useApi<{ courses: Array<{ id: string }> }>("/api/courses");

  const registered = (whitelist.data?.items ?? []).filter(
    (e) => e.status === "REGISTERED",
  ).length;
  const pending = (whitelist.data?.items ?? []).filter(
    (e) => e.status === "PENDING",
  ).length;
  const activeAssignments = (assignments.data?.items ?? []).filter((a) =>
    ["PUBLISHED", "SUBMISSION_OPEN", "SUBMISSION_CLOSED", "REVIEW_OPEN"].includes(a.status),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Öğretmen Paneli</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/teacher/whitelist">Öğrenci Davet Et</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/teacher/assignments/new">Yeni Ödev</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Kayıtlı Öğrenci</CardDescription>
            <CardTitle className="text-3xl">
              {whitelist.loading ? "…" : registered}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{pending} davet bekliyor</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ders</CardDescription>
            <CardTitle className="text-3xl">
              {courses.loading ? "…" : (courses.data?.courses.length ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/teacher/courses"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Dersleri yönet →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktif Ödev</CardDescription>
            <CardTitle className="text-3xl">
              {assignments.loading ? "…" : activeAssignments.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/teacher/assignments"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Tüm ödevler →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ödev Havuzu</CardDescription>
            <CardTitle className="text-3xl">
              {assignments.loading
                ? "…"
                : activeAssignments.reduce((sum, a) => sum + a._count.submissions, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/teacher/pool"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Teslimleri incele →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktif Ödevler</CardTitle>
          <CardDescription>Süreci devam eden ödevlerin durumu</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.loading ? (
            <LoadingBox rows={3} />
          ) : assignments.error ? (
            <ErrorBox message={assignments.error} />
          ) : activeAssignments.length === 0 ? (
            <EmptyState
              title="Aktif ödev yok"
              description="Yeni bir ödev oluşturup yayınlayın."
            />
          ) : (
            <ul className="divide-y">
              {activeAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <Link
                      href={`/teacher/assignments/${assignment.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {assignment.course.name} · {assignment._count.submissions} teslim ·{" "}
                      {assignment._count.peerAssignments} atama
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Teslim bitişi: <DateText value={assignment.submissionEndsAt} />
                    </p>
                  </div>
                  <AssignmentStatusBadge status={assignment.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
