"use client";

import { use } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateText } from "@/components/shared/date-text";
import { ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { CommentThread } from "@/components/comments/comment-thread";
import { LinkList } from "@/components/submissions/link-list";
import { useApi } from "@/lib/api/use-api";

type SubmissionDetail = {
  submission: {
    id: string;
    title: string;
    description: string;
    status: string;
    submittedAt: string | null;
    isMine: boolean;
    links: Array<{ id: string; label: string | null; url: string }>;
    assignment: { id: string; title: string };
  };
};

type Me = { user: { id: string; role: string } };

export default function StudentSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const detail = useApi<SubmissionDetail>(`/api/submissions/${id}`);
  const me = useApi<Me>("/api/auth/me");

  if (detail.loading || me.loading) return <LoadingBox rows={4} />;
  if (detail.error) return <ErrorBox message={detail.error} />;
  if (me.error) return <ErrorBox message={me.error} />;
  if (!detail.data || !me.data) return null;

  const { submission } = detail.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{submission.assignment.title}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {submission.title}
          {submission.isMine ? (
            <span className="ml-2 text-sm font-normal text-emerald-600">
              (Sizin tesliminiz)
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teslim tarihi: <DateText value={submission.submittedAt} />
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Açıklama ve Odak Noktası</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{submission.description}</p>
          <div>
            <p className="mb-1 text-sm font-medium">Bağlantılar</p>
            <LinkList links={submission.links} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yorumlar</CardTitle>
          <CardDescription>
            Bu teslim hakkında soru sorabilir veya geri bildirim bırakabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommentThread
            submissionId={submission.id}
            currentUser={{ id: me.data.user.id, role: me.data.user.role }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
