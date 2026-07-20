"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  module: { title: string } | null;
  _count: { submissions: number; peerAssignments: number };
};

export default function TeacherAssignmentsPage() {
  const { data, error, loading } = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=100",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Ödevler</h1>
        <Button asChild>
          <Link href="/teacher/assignments/new">Yeni Ödev</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tüm Ödevler</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox rows={4} />
          ) : error ? (
            <ErrorBox message={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Henüz ödev yok"
              description="İlk ödevi oluşturmak için 'Yeni Ödev' butonunu kullanın."
            />
          ) : (
            <ul className="divide-y">
              {data!.items.map((assignment) => (
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
                      {assignment.course.name}
                      {assignment.module ? ` · ${assignment.module.title}` : ""} ·{" "}
                      {assignment._count.submissions} teslim ·{" "}
                      {assignment._count.peerAssignments} atama
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Teslim: <DateText value={assignment.submissionEndsAt} /> ·
                      Değerlendirme: <DateText value={assignment.reviewEndsAt} />
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
