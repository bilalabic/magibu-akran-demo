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
  _count: { submissions: number };
  mySubmission: { id: string; status: string } | null;
};

// Ödev havuzu girişi: yayınlanmış tüm ödevlerin havuzlarına erişim.
// Havuz, teslim süresi bitmeden de görüntülenebilir.
export default function StudentPoolIndexPage() {
  const { data, error, loading } = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=50",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ödev Havuzu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arkadaşlarınızın teslimlerini inceleyin ve yorum yapın. Havuz, teslim süresi
          bitmeden de açıktır.
        </p>
      </div>

      {loading ? (
        <LoadingBox rows={3} />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="Henüz ödev yok"
          description="Öğretmeniniz ödev yayınladığında havuzları burada listelenir."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data!.items.map((assignment) => (
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
                  {assignment._count.submissions} teslim
                  {assignment.mySubmission ? " · Sizinki dahil" : ""}
                </span>
                <Button asChild size="sm">
                  <Link href={`/student/assignments/${assignment.id}/pool`}>
                    Havuzu Gör
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
