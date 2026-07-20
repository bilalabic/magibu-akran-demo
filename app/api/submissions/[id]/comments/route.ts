import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload } from "@/lib/email/process";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { NotificationType, UserRole } from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmail } from "@/lib/jobs/qstash";
import { commentCreateSchema } from "@/lib/validation/submission";
import {
  assertCanViewSubmission,
  getSubmissionOrThrow,
} from "@/server/services/submission-access";

type Params = { id: string };

function serializeComment(comment: {
  id: string;
  content: string;
  isDeleted: boolean;
  editedAt: Date | null;
  createdAt: Date;
  parentId: string | null;
  author: { id: string; name: string; role: UserRole };
}) {
  return {
    id: comment.id,
    content: comment.isDeleted ? "" : comment.content,
    isDeleted: comment.isDeleted,
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
    parentId: comment.parentId,
    author: comment.isDeleted
      ? null
      : { id: comment.author.id, name: comment.author.name, role: comment.author.role },
  };
}

// FR-5.3..5.6: Teslim altındaki yorumlar (üst yorum + yanıtlar).
export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const submission = await getSubmissionOrThrow(id);
  await assertCanViewSubmission(user, submission);

  const comments = await prisma.comment.findMany({
    where: { submissionId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  const topLevel = comments.filter((c) => c.parentId === null);
  const threads = topLevel.map((parent) => ({
    ...serializeComment(parent),
    replies: comments.filter((c) => c.parentId === parent.id).map(serializeComment),
  }));

  return ok({ comments: threads });
});

// FR-5.4: Yorum oluşturma. FR-5.9: teslim sahibine e-posta bildirimi.
export const POST = withErrorHandling<Params>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const body = await parseJsonBody(req, commentCreateSchema);

  const submission = await getSubmissionOrThrow(id);
  await assertCanViewSubmission(user, submission);

  const comment = await prisma.comment.create({
    data: { submissionId: id, authorId: user.id, content: body.content },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  // Teslim sahibine bildirim (kendi teslimine yorum yapan hariç)
  if (submission.studentId !== user.id) {
    const owner = await prisma.user.findUnique({
      where: { id: submission.studentId },
      select: { id: true, email: true, role: true },
    });
    if (owner) {
      const basePath = owner.role === UserRole.TEACHER ? "/teacher" : "/student";
      await enqueueEmail(
        buildEmailPayload({
          jobKey: jobKeys.submissionComment(comment.id),
          type: NotificationType.SUBMISSION_COMMENT,
          to: owner.email,
          recipientUserId: owner.id,
          data: {
            submissionTitle: submission.title,
            authorName: user.name,
            excerpt: body.content.slice(0, 140),
            url: `${appUrl()}${basePath}/submissions/${submission.id}`,
          },
        }),
      );
    }
  }

  return ok({ comment: { ...serializeComment(comment), replies: [] } }, { status: 201 });
});
