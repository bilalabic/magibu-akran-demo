import { requireAuth } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload } from "@/lib/email/process";
import { ApiError, ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import { NotificationType, UserRole } from "@/lib/generated/prisma/enums";
import { jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmail } from "@/lib/jobs/qstash";
import { commentCreateSchema } from "@/lib/validation/submission";
import {
  assertCanViewSubmission,
  getSubmissionOrThrow,
} from "@/server/services/submission-access";

type Params = { id: string };

// FR-5.5/5.6: Yoruma yanıt (tek seviye: yanıtın yanıtı da aynı üst yoruma bağlanır).
// FR-5.10: yorum sahibine e-posta bildirimi.
export const POST = withErrorHandling<Params>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const body = await parseJsonBody(req, commentCreateSchema);

  const parent = await prisma.comment.findUnique({
    where: { id },
    include: { author: { select: { id: true, email: true, role: true } } },
  });
  if (!parent || parent.isDeleted) {
    throw new ApiError("NOT_FOUND", "Yanıtlanacak yorum bulunamadı.");
  }

  const submission = await getSubmissionOrThrow(parent.submissionId);
  await assertCanViewSubmission(user, submission);

  // Yanıtın yanıtı: üst yorum her zaman kök yorumdur (iki seviyeli görünüm)
  const rootParentId = parent.parentId ?? parent.id;

  const reply = await prisma.comment.create({
    data: {
      submissionId: parent.submissionId,
      authorId: user.id,
      parentId: rootParentId,
      content: body.content,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  // FR-5.10: yanıtlanan kişiye bildirim
  if (parent.authorId !== user.id) {
    const basePath = parent.author.role === UserRole.TEACHER ? "/teacher" : "/student";
    await enqueueEmail(
      buildEmailPayload({
        jobKey: jobKeys.commentReply(reply.id),
        type: NotificationType.COMMENT_REPLY,
        to: parent.author.email,
        recipientUserId: parent.author.id,
        data: {
          authorName: user.name,
          excerpt: body.content.slice(0, 140),
          url: `${appUrl()}${basePath}/submissions/${submission.id}`,
        },
      }),
    );
  }

  // FR-5.9: teslim sahibi de yanıttan haberdar edilir (yanıtı yazan veya
  // yanıtlanan kişi zaten kendisiyse mükerrer e-posta gönderilmez).
  if (submission.studentId !== user.id && submission.studentId !== parent.authorId) {
    const owner = await prisma.user.findUnique({
      where: { id: submission.studentId },
      select: { id: true, email: true, role: true },
    });
    if (owner) {
      const ownerBasePath = owner.role === UserRole.TEACHER ? "/teacher" : "/student";
      await enqueueEmail(
        buildEmailPayload({
          jobKey: jobKeys.submissionComment(reply.id),
          type: NotificationType.SUBMISSION_COMMENT,
          to: owner.email,
          recipientUserId: owner.id,
          data: {
            submissionTitle: submission.title,
            authorName: user.name,
            excerpt: body.content.slice(0, 140),
            url: `${appUrl()}${ownerBasePath}/submissions/${submission.id}`,
          },
        }),
      );
    }
  }

  return ok(
    {
      comment: {
        id: reply.id,
        content: reply.content,
        isDeleted: false,
        editedAt: null,
        createdAt: reply.createdAt,
        parentId: reply.parentId,
        author: { id: reply.author.id, name: reply.author.name, role: reply.author.role },
      },
    },
    { status: 201 },
  );
});
