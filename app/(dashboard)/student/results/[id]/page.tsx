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
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { useApi } from "@/lib/api/use-api";

type StudentReport = {
  report: {
    assignment: { id: string; title: string; status: string };
    hasSubmission: boolean;
    submission?: { title: string; submittedAt: string | null };
    reviewCount: number;
    overallAverage: number | null;
    criteria: Array<{
      id: string;
      title: string;
      type: "SCORE" | "TEXT";
      minScore: number | null;
      maxScore: number | null;
      scores: number[];
      average: number | null;
      texts: string[];
    }>;
  };
};

// Öğrenci sonuç karnesi — geri bildirimler anonimdir (FR-7.10).
export default function StudentResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading } = useApi<StudentReport>(
    `/api/student/assignments/${id}/report`,
  );

  if (loading) return <LoadingBox rows={4} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { report } = data;

  if (!report.hasSubmission) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {report.assignment.title}
        </h1>
        <EmptyState
          title="Bu ödev için tesliminiz yok"
          description="Teslim yapmadığınız için karne oluşturulmadı."
        />
      </div>
    );
  }

  const scoreCriteria = report.criteria.filter((c) => c.type === "SCORE");
  const textCriteria = report.criteria.filter((c) => c.type === "TEXT");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Sonuç Karnesi</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {report.assignment.title}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/student/results">← Sonuçlarım</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Genel Ortalama</CardDescription>
            <CardTitle className="text-3xl">
              {report.overallAverage !== null ? report.overallAverage.toFixed(2) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Değerlendirme Sayısı</CardDescription>
            <CardTitle className="text-3xl">{report.reviewCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teslim</CardDescription>
            <CardTitle className="truncate text-base">
              {report.submission?.title}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kriter Bazlı Puanlar</CardTitle>
        </CardHeader>
        <CardContent>
          {scoreCriteria.length === 0 ? (
            <EmptyState title="Sayısal kriter yok" />
          ) : (
            <ul className="space-y-3">
              {scoreCriteria.map((criterion) => (
                <li
                  key={criterion.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{criterion.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Aldığınız puanlar:{" "}
                      {criterion.scores.length > 0 ? criterion.scores.join(", ") : "—"}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">
                    {criterion.average !== null ? criterion.average.toFixed(2) : "—"}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      / {criterion.maxScore ?? 10}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anonim Geri Bildirimler</CardTitle>
          <CardDescription>
            Değerlendiren öğrencilerin kimlikleri gösterilmez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {textCriteria.every((c) => c.texts.length === 0) ? (
            <EmptyState title="Metin geri bildirimi yok" />
          ) : (
            textCriteria.map((criterion) =>
              criterion.texts.length > 0 ? (
                <div key={criterion.id}>
                  <p className="mb-2 text-sm font-medium">{criterion.title}</p>
                  <ul className="space-y-2">
                    {criterion.texts.map((text, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap"
                      >
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
