import { verifyCronRequest } from "@/lib/cron/auth";
import { withJobLog } from "@/lib/cron/job-log";
import { expectedStatusByDates, statusRank } from "@/lib/assignments/status";
import { prisma } from "@/lib/db/prisma";
import { ok, withErrorHandling } from "@/lib/errors";
import {
  AssignmentStatus,
  PeerAssignmentStatus,
  SubmissionStatus,
} from "@/lib/generated/prisma/enums";
import { generatePeerAssignments } from "@/server/services/peer-assignment-service";

// FR-3.6 + döküman 15.2: Tarih bazlı durum geçişleri.
//  - SUBMISSION_CLOSED'a geçişte SUBMITTED teslimler kilitlenir ve akran
//    atamaları otomatik başlatılır (idempotent).
//  - REVIEW_CLOSED'a geçişte tamamlanmamış görevler EXPIRED yapılır.
export const GET = withErrorHandling(async (req) => {
  await verifyCronRequest(req, "/api/cron/process-assignment-statuses");

  const result = await withJobLog("process-assignment-statuses", async () => {
    const now = new Date();
    const active = await prisma.assignment.findMany({
      where: {
        status: {
          in: [
            AssignmentStatus.PUBLISHED,
            AssignmentStatus.SUBMISSION_OPEN,
            AssignmentStatus.SUBMISSION_CLOSED,
            AssignmentStatus.REVIEW_OPEN,
          ],
        },
      },
    });

    const transitions: Array<{ id: string; from: string; to: string }> = [];
    const generation: Array<{ id: string; created: number; warnings: string[] }> = [];

    for (const assignment of active) {
      const expected = expectedStatusByDates(assignment.status, assignment, now);
      if (!expected) continue;

      const crossedSubmissionClose =
        statusRank(assignment.status) < statusRank(AssignmentStatus.SUBMISSION_CLOSED) &&
        statusRank(expected) >= statusRank(AssignmentStatus.SUBMISSION_CLOSED);
      const crossedReviewClose =
        statusRank(expected) >= statusRank(AssignmentStatus.REVIEW_CLOSED);

      await prisma.$transaction(async (tx) => {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { status: expected },
        });

        if (crossedSubmissionClose) {
          await tx.submission.updateMany({
            where: { assignmentId: assignment.id, status: SubmissionStatus.SUBMITTED },
            data: { status: SubmissionStatus.LOCKED, lockedAt: now },
          });
        }

        if (crossedReviewClose) {
          await tx.peerAssignment.updateMany({
            where: {
              assignmentId: assignment.id,
              status: {
                in: [PeerAssignmentStatus.ASSIGNED, PeerAssignmentStatus.IN_PROGRESS],
              },
            },
            data: { status: PeerAssignmentStatus.EXPIRED },
          });
        }
      });

      transitions.push({ id: assignment.id, from: assignment.status, to: expected });

      // Teslim süreci kapandıysa (ve değerlendirme süreci hâlâ açıksa) atama üret
      if (crossedSubmissionClose && !crossedReviewClose) {
        try {
          const genResult = await generatePeerAssignments(assignment.id);
          generation.push({
            id: assignment.id,
            created: genResult.created,
            warnings: genResult.warnings,
          });
        } catch (error) {
          generation.push({
            id: assignment.id,
            created: 0,
            warnings: [error instanceof Error ? error.message : "Atama üretilemedi"],
          });
        }
      }
    }

    return { checked: active.length, transitions, generation };
  });

  return ok(result);
});
