"use client";

import Link from "next/link";

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
  SubmissionStatusBadge,
} from "@/components/shared/status-badge";
import { useApi } from "@/lib/api/use-api";

type AssignmentListItem = {
  id: string;
  title: string;
  status: string;
  submissionStartsAt: string;
  submissionEndsAt: string;
  reviewEndsAt: string;
  course: { name: string };
  module: { title: string } | null;
  mySubmission: { id: string; status: string } | null;
};

export default function StudentAssignmentsPage() {
  const { data, error, loading } = useApi<{ items: AssignmentListItem[] }>(
    "/api/assignments?page=1&pageSize=100",
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ödevler</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ödev Listesi</CardTitle>
          <CardDescription>
            Üye olduğunuz derslerin yayınlanmış tüm ödevleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox rows={4} />
          ) : error ? (
            <ErrorBox message={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Henüz ödev yok" />
          ) : (
            <ul className="divide-y">
              {data!.items.map((assignment) => (
                <li key={assignment.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {assignment.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {assignment.course.name}
                        {assignment.module ? ` · ${assignment.module.title}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Teslim: <DateText value={assignment.submissionEndsAt} /> ·
                        Değerlendirme bitişi: <DateText value={assignment.reviewEndsAt} />
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <AssignmentStatusBadge status={assignment.status} />
                      {assignment.mySubmission ? (
                        <SubmissionStatusBadge status={assignment.mySubmission.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Teslim yok</span>
                      )}
                    </div>
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
