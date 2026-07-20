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
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import { useApi } from "@/lib/api/use-api";

type AssignmentListItem = {
  id: string;
  title: string;
  status: string;
  course: { name: string };
  mySubmission: { id: string; status: string } | null;
};

export default function StudentResultsPage() {
  const { data, error, loading } = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=100",
  );

  const finished = (data?.items ?? []).filter((a) =>
    ["REVIEW_CLOSED", "COMPLETED", "ARCHIVED"].includes(a.status),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sonuçlarım</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tamamlanan Ödevler</CardTitle>
          <CardDescription>
            Değerlendirme süreci kapanan ödevlerin sonuç karneleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox rows={3} />
          ) : error ? (
            <ErrorBox message={error} />
          ) : finished.length === 0 ? (
            <EmptyState
              title="Henüz sonuç yok"
              description="Değerlendirme süreci kapandığında sonuçlarınız burada görünür."
            />
          ) : (
            <ul className="divide-y">
              {finished.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">{assignment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.course.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AssignmentStatusBadge status={assignment.status} />
                    {assignment.mySubmission ? (
                      <Button asChild size="sm">
                        <Link href={`/student/results/${assignment.id}`}>Karnemi Gör</Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Teslim yapılmadı</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
