"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateText } from "@/components/shared/date-text";
import { EmptyState, ErrorBox, LoadingBox } from "@/components/shared/feedback";
import { ApiClientError, apiDelete, apiPatch, apiPost } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { ROLE_LABELS } from "@/lib/constants/labels";

type CommentAuthor = { id: string; name: string; role: string } | null;

type CommentItem = {
  id: string;
  content: string;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  parentId: string | null;
  author: CommentAuthor;
};

type CommentThreadItem = CommentItem & { replies: CommentItem[] };

// FR-5.3..5.8: yorum + yanıt + düzenle/sil + öğretmen moderasyonu.
export function CommentThread({
  submissionId,
  currentUser,
}: {
  submissionId: string;
  currentUser: { id: string; role: string };
}) {
  const { data, error, loading, refetch } = useApi<{ comments: CommentThreadItem[] }>(
    `/api/submissions/${submissionId}/comments`,
  );
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, successMessage?: string) {
    setBusy(true);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newComment.trim()) return;
    void run(async () => {
      await apiPost(`/api/submissions/${submissionId}/comments`, {
        content: newComment.trim(),
      });
      setNewComment("");
    }, "Yorum eklendi.");
  }

  if (loading) return <LoadingBox rows={2} />;
  if (error) return <ErrorBox message={error} />;
  const comments = data?.comments ?? [];

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Bu teslim hakkında yorum yazın…"
          maxLength={2000}
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy || !newComment.trim()}>
            Yorum Yap
          </Button>
        </div>
      </form>

      {comments.length === 0 ? (
        <EmptyState title="Henüz yorum yok" description="İlk yorumu siz yapın." />
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentCard
                comment={comment}
                currentUser={currentUser}
                busy={busy}
                onAction={run}
              />
              {comment.replies.length > 0 ? (
                <ul className="ml-6 mt-2 space-y-2 border-l pl-4">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentCard
                        comment={reply}
                        currentUser={currentUser}
                        busy={busy}
                        onAction={run}
                        isReply
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentCard({
  comment,
  currentUser,
  busy,
  onAction,
  isReply = false,
}: {
  comment: CommentItem;
  currentUser: { id: string; role: string };
  busy: boolean;
  onAction: (action: () => Promise<unknown>, successMessage?: string) => Promise<void> | void;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);

  if (comment.isDeleted) {
    return (
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground italic">
        Bu yorum silindi.
      </div>
    );
  }

  const isOwn = comment.author?.id === currentUser.id;
  const canModerate = isOwn || currentUser.role === "TEACHER";

  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {comment.author?.name}
          {comment.author?.role === "TEACHER" ? (
            <span className="ml-1 text-xs text-muted-foreground">
              ({ROLE_LABELS.TEACHER})
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          <DateText value={comment.createdAt} />
          {comment.editedAt ? " · düzenlendi" : ""}
        </p>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !editText.trim()}
              onClick={() =>
                onAction(async () => {
                  await apiPatch(`/api/comments/${comment.id}`, {
                    content: editText.trim(),
                  });
                  setEditing(false);
                }, "Yorum güncellendi.")
              }
            >
              Kaydet
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      )}

      <div className="mt-2 flex gap-3 text-xs">
        {!isReply ? (
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setReplying((v) => !v)}
          >
            Yanıtla
          </button>
        ) : null}
        {isOwn && !editing ? (
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setEditText(comment.content);
              setEditing(true);
            }}
          >
            Düzenle
          </button>
        ) : null}
        {canModerate ? (
          <button
            type="button"
            className="text-destructive underline-offset-4 hover:underline"
            onClick={() => {
              if (window.confirm("Bu yorumu silmek istediğinize emin misiniz?")) {
                void onAction(
                  () => apiDelete(`/api/comments/${comment.id}`),
                  "Yorum silindi.",
                );
              }
            }}
          >
            Sil
          </button>
        ) : null}
      </div>

      {replying ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Yanıtınızı yazın…"
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !replyText.trim()}
              onClick={() =>
                onAction(async () => {
                  await apiPost(`/api/comments/${comment.id}/replies`, {
                    content: replyText.trim(),
                  });
                  setReplyText("");
                  setReplying(false);
                }, "Yanıt eklendi.")
              }
            >
              Yanıtla
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
