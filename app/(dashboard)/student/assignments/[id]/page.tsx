"use client";

import Link from "next/link";
import { use } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DateText } from "@/components/shared/date-text";
import { ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import {
  SubmissionForm,
  type ExistingSubmission,
} from "@/components/submissions/submission-form";
import { useApi } from "@/lib/api/use-api";

type AssignmentDetail = {
  assignment: {
    id: string;
    title: string;
    description: string;
    linkRules: string | null;
    status: string;
    submissionStartsAt: string;
    submissionEndsAt: string;
    reviewStartsAt: string;
    reviewEndsAt: string;
    requiredReviewCount: number;
    course: { name: string } | null;
    module: { title: string } | null;
    submittedCount: number;
    submissionWindowOpen: boolean;
  };
  rubric: {
    title: string;
    criteria: Array<{
      id: string;
      title: string;
      description: string | null;
      type: string;
      minScore: number | null;
      maxScore: number | null;
    }>;
  } | null;
  mySubmission: (NonNullable<ExistingSubmission> & { submittedAt: string | null }) | null;
};

export default function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading, refetch } = useApi<AssignmentDetail>(
    `/api/assignments/${id}`,
  );

  if (loading) return <LoadingBox rows={4} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { assignment, rubric, mySubmission } = data;
  const resultsVisible = ["REVIEW_CLOSED", "COMPLETED", "ARCHIVED"].includes(
    assignment.status,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{assignment.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assignment.course?.name}
            {assignment.module ? ` · ${assignment.module.title}` : ""}
          </p>
        </div>
        <AssignmentStatusBadge status={assignment.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ödev Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{assignment.description}</p>
          {assignment.linkRules ? (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Bağlantı kuralları</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {assignment.linkRules}
              </p>
            </div>
          ) : null}
          <Separator />
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Teslim başlangıcı:</span>{" "}
              <DateText value={assignment.submissionStartsAt} />
            </p>
            <p>
              <span className="text-muted-foreground">Teslim bitişi:</span>{" "}
              <DateText value={assignment.submissionEndsAt} />
            </p>
            <p>
              <span className="text-muted-foreground">Değerlendirme başlangıcı:</span>{" "}
              <DateText value={assignment.reviewStartsAt} />
            </p>
            <p>
              <span className="text-muted-foreground">Değerlendirme bitişi:</span>{" "}
              <DateText value={assignment.reviewEndsAt} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/student/assignments/${assignment.id}/pool`}>
                Ödev Havuzunu Gör ({assignment.submittedCount} teslim)
              </Link>
            </Button>
            {resultsVisible ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/student/results/${assignment.id}`}>Sonuçlarımı Gör</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teslimim</CardTitle>
          <CardDescription>
            {assignment.submissionWindowOpen
              ? "Teslim süresi bitene kadar güncelleyebilirsiniz."
              : "Teslim penceresi şu anda kapalı."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mySubmission || assignment.submissionWindowOpen ? (
            <SubmissionForm
              assignmentId={assignment.id}
              existing={mySubmission}
              windowOpen={assignment.submissionWindowOpen}
              onSaved={refetch}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Bu ödev için teslim yapmadınız ve teslim penceresi kapalı.
            </p>
          )}
        </CardContent>
      </Card>

      {rubric ? (
        <Card>
          <CardHeader>
            <CardTitle>Değerlendirme Rubriği</CardTitle>
            <CardDescription>
              Teslimler bu kriterlere göre {assignment.requiredReviewCount} akran
              tarafından değerlendirilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rubric.criteria.map((criterion) => (
                <li key={criterion.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {criterion.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {criterion.type === "SCORE"
                        ? `Puan ${criterion.minScore ?? 1}-${criterion.maxScore ?? 10}`
                        : "Metin"}
                    </span>
                  </p>
                  {criterion.description ? (
                    <p className="mt-0.5 text-muted-foreground">{criterion.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
