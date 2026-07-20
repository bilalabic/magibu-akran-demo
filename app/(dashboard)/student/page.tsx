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
import {
  AssignmentStatusBadge,
  PeerAssignmentStatusBadge,
} from "@/components/shared/status-badge";
import { useApi } from "@/lib/api/use-api";

type AssignmentListItem = {
  id: string;
  title: string;
  status: string;
  submissionEndsAt: string;
  reviewEndsAt: string;
  course: { name: string };
  mySubmission: { id: string; status: string } | null;
};

type PeerAssignmentItem = {
  id: string;
  status: string;
  expiresAt: string;
  assignment: { title: string };
  review: { status: string } | null;
};

export default function StudentDashboardPage() {
  const assignments = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=50",
  );
  const reviews = useApi<{ items: PeerAssignmentItem[] }>(
    "/api/peer-assignments?page=1&pageSize=50",
  );

  const openAssignments = (assignments.data?.items ?? []).filter(
    (a) => a.status === "SUBMISSION_OPEN" || a.status === "PUBLISHED",
  );
  const pendingReviews = (reviews.data?.items ?? []).filter(
    (r) => r.status === "ASSIGNED" || r.status === "IN_PROGRESS",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/student/pool">Ödev Havuzuna Git</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aktif Ödevler</CardTitle>
            <CardDescription>Teslim süreci devam eden ödevler</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.loading ? (
              <LoadingBox rows={2} />
            ) : assignments.error ? (
              <ErrorBox message={assignments.error} />
            ) : openAssignments.length === 0 ? (
              <EmptyState title="Şu anda aktif ödev yok" />
            ) : (
              <ul className="space-y-3">
                {openAssignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.course.name} · Son teslim:{" "}
                        <DateText value={assignment.submissionEndsAt} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.mySubmission?.status === "SUBMITTED" ||
                      assignment.mySubmission?.status === "LOCKED" ? (
                        <span className="text-xs text-emerald-600">Teslim edildi ✓</span>
                      ) : null}
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/student/assignments/${assignment.id}/pool`}>
                          Havuz
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/student/assignments/${assignment.id}`}>Git</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bekleyen Değerlendirmelerim</CardTitle>
            <CardDescription>Size atanan akran değerlendirme görevleri</CardDescription>
          </CardHeader>
          <CardContent>
            {reviews.loading ? (
              <LoadingBox rows={2} />
            ) : reviews.error ? (
              <ErrorBox message={reviews.error} />
            ) : pendingReviews.length === 0 ? (
              <EmptyState title="Bekleyen değerlendirme yok" />
            ) : (
              <ul className="space-y-3">
                {pendingReviews.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{task.assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Son tarih: <DateText value={task.expiresAt} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PeerAssignmentStatusBadge status={task.status} />
                      <Button asChild size="sm">
                        <Link href={`/student/reviews/${task.id}`}>Değerlendir</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tüm Ödevler</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.loading ? (
            <LoadingBox rows={3} />
          ) : assignments.error ? (
            <ErrorBox message={assignments.error} />
          ) : (assignments.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Henüz ödev yok"
              description="Öğretmeniniz ödev yayınladığında burada görünür."
            />
          ) : (
            <ul className="divide-y">
              {assignments.data!.items.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <Link
                      href={`/student/assignments/${assignment.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {assignment.course.name}
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
