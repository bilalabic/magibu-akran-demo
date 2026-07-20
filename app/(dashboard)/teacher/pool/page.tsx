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
  course: { name: string };
  _count: { submissions: number; peerAssignments: number };
};

// Öğretmen için havuz girişi: her ödevin teslim havuzuna hızlı erişim.
export default function TeacherPoolIndexPage() {
  const { data, error, loading } = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=50",
  );

  const items = (data?.items ?? []).filter((a) => a.status !== "DRAFT");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ödev Havuzu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Yayınlanmış ödevlerin teslimlerini görüntüleyin. Havuz, teslim süresi bitmeden
          de açıktır.
        </p>
      </div>

      {loading ? (
        <LoadingBox rows={3} />
      ) : error ? (
        <ErrorBox message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Yayınlanmış ödev yok"
          description="Bir ödev yayınladığınızda havuzu burada listelenir."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{assignment.title}</CardTitle>
                  <AssignmentStatusBadge status={assignment.status} />
                </div>
                <CardDescription>
                  {assignment.course.name} · Son teslim:{" "}
                  <DateText value={assignment.submissionEndsAt} />
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {assignment._count.submissions} teslim ·{" "}
                  {assignment._count.peerAssignments} atama
                </span>
                <Button asChild size="sm">
                  <Link href={`/teacher/assignments/${assignment.id}`}>
                    Teslimleri Gör
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
