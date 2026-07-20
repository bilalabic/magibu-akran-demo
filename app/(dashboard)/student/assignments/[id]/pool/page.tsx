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
import { DateText } from "@/components/shared/date-text";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { LinkList } from "@/components/submissions/link-list";
import { useApi } from "@/lib/api/use-api";

type PoolItem = {
  id: string;
  title: string;
  description: string;
  submittedAt: string | null;
  commentCount: number;
  isMine: boolean;
  links: Array<{ id: string; label: string | null; url: string }>;
};

// FR-5.1/5.2: Ödev havuzu (teslim sahibi kimliği öğrencilere gösterilmez).
export default function SubmissionPoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading } = useApi<{ items: PoolItem[] }>(
    `/api/assignments/${id}/submissions?page=1&pageSize=100`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ödev Havuzu</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={`/student/assignments/${id}`}>← Ödeve Dön</Link>
        </Button>
      </div>

      {loading ? (
        <LoadingBox rows={3} />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Havuzda teslim yok" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data!.items.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {submission.title}
                  {submission.isMine ? (
                    <span className="ml-2 text-xs font-normal text-emerald-600">
                      (Sizin tesliminiz)
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  Teslim tarihi: <DateText value={submission.submittedAt} />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {submission.description}
                </p>
                <LinkList links={submission.links} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {submission.commentCount} yorum
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/student/submissions/${submission.id}`}>
                      Detay ve Yorumlar
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
