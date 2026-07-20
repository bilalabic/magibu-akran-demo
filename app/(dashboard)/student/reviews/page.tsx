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
import { PeerAssignmentStatusBadge } from "@/components/shared/status-badge";
import { useApi } from "@/lib/api/use-api";

type PeerAssignmentItem = {
  id: string;
  status: string;
  assignedAt: string;
  expiresAt: string;
  assignment: { id: string; title: string; reviewEndsAt: string };
  submission: { id: string; title: string };
  review: { id: string; status: string; submittedAt: string | null } | null;
};

// FR-7.6: Öğrenci yalnızca kendine atanan teslimleri görür ve değerlendirir.
export default function StudentReviewsPage() {
  const { data, error, loading } = useApi<{ items: PeerAssignmentItem[] }>(
    "/api/peer-assignments?page=1&pageSize=100",
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Değerlendirmelerim</h1>
      <Card>
        <CardHeader>
          <CardTitle>Akran Değerlendirme Görevleri</CardTitle>
          <CardDescription>
            Size atanan teslimleri rubrik üzerinden değerlendirin. Değerlendirmeler
            anonimdir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox rows={3} />
          ) : error ? (
            <ErrorBox message={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Henüz değerlendirme göreviniz yok"
              description="Teslim süresi kapandığında atamalar burada görünür."
            />
          ) : (
            <ul className="divide-y">
              {data!.items.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">{task.submission.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.assignment.title} · Son tarih:{" "}
                      <DateText value={task.expiresAt} />
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PeerAssignmentStatusBadge status={task.status} />
                    <Button asChild size="sm" variant={task.status === "COMPLETED" ? "outline" : "default"}>
                      <Link href={`/student/reviews/${task.id}`}>
                        {task.status === "COMPLETED" ? "Görüntüle" : "Değerlendir"}
                      </Link>
                    </Button>
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
