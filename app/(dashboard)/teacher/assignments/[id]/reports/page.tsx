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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { useApi } from "@/lib/api/use-api";

type Report = {
  report: {
    assignment: { id: string; title: string; status: string };
    courseName: string;
    moduleTitle: string | null;
    criteria: Array<{ id: string; title: string; type: "SCORE" | "TEXT" }>;
    rows: Array<{
      student: { id: string; name: string; email: string };
      submission: { title: string; status: string } | null;
      assignedReviewCount: number;
      completedReviewCount: number;
      reviewerAssignedCount: number;
      reviewerCompletedCount: number;
      averageByCriterion: Record<string, number | null>;
      overallAverage: number | null;
    }>;
    classAverageByCriterion: Record<string, number | null>;
    classOverallAverage: number | null;
    stats: {
      studentCount: number;
      submittedCount: number;
      assignedReviewCount: number;
      completedReviewCount: number;
    };
  };
};

// FR-9: Ödev raporu — özet istatistikler, kriter ortalamaları, CSV/Excel export.
export default function TeacherReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading } = useApi<Report>(
    `/api/teacher/assignments/${id}/reports/summary`,
  );

  if (loading) return <LoadingBox rows={4} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { report } = data;
  const scoreCriteria = report.criteria.filter((c) => c.type === "SCORE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {report.courseName}
            {report.moduleTitle ? ` · ${report.moduleTitle}` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Rapor: {report.assignment.title}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/assignments/${id}`}>← Ödeve Dön</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`/api/teacher/assignments/${id}/reports/export.csv`}>CSV İndir</a>
          </Button>
          <Button asChild size="sm">
            <a href={`/api/teacher/assignments/${id}/reports/export.xlsx`}>Excel İndir</a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Öğrenci</CardDescription>
            <CardTitle className="text-3xl">{report.stats.studentCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teslim</CardDescription>
            <CardTitle className="text-3xl">{report.stats.submittedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Değerlendirme (tamam/atanan)</CardDescription>
            <CardTitle className="text-3xl">
              {report.stats.completedReviewCount}/{report.stats.assignedReviewCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sınıf Ortalaması</CardDescription>
            <CardTitle className="text-3xl">
              {report.classOverallAverage !== null
                ? report.classOverallAverage.toFixed(2)
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Öğrenci Bazlı Sonuçlar</CardTitle>
          <CardDescription>
            Kriter ortalamaları ve değerlendirme tamamlama durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <EmptyState title="Raporlanacak öğrenci yok" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Teslim</TableHead>
                    <TableHead>Aldığı Değ.</TableHead>
                    <TableHead>Yaptığı Değ.</TableHead>
                    {scoreCriteria.map((criterion) => (
                      <TableHead key={criterion.id}>{criterion.title}</TableHead>
                    ))}
                    <TableHead>Genel Ort.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={row.student.id}>
                      <TableCell className="font-medium">
                        {row.student.name}
                        <p className="text-xs font-normal text-muted-foreground">
                          {row.student.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        {row.submission ? (
                          <SubmissionStatusBadge status={row.submission.status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Yok</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.completedReviewCount}/{row.assignedReviewCount}
                      </TableCell>
                      <TableCell>
                        {row.reviewerCompletedCount}/{row.reviewerAssignedCount}
                      </TableCell>
                      {scoreCriteria.map((criterion) => (
                        <TableCell key={criterion.id}>
                          {row.averageByCriterion[criterion.id]?.toFixed(2) ?? "—"}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold">
                        {row.overallAverage !== null
                          ? row.overallAverage.toFixed(2)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {scoreCriteria.length > 0 ? (
                  <tfoot>
                    <TableRow>
                      <TableCell colSpan={4} className="font-medium">
                        Sınıf Ortalaması
                      </TableCell>
                      {scoreCriteria.map((criterion) => (
                        <TableCell key={criterion.id} className="font-medium">
                          {report.classAverageByCriterion[criterion.id]?.toFixed(2) ?? "—"}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold">
                        {report.classOverallAverage !== null
                          ? report.classOverallAverage.toFixed(2)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                ) : null}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
