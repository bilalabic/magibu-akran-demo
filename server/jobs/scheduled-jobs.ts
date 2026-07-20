import "server-only";

import { expectedStatusByDates, statusRank } from "@/lib/assignments/status";
import { withJobLog } from "@/lib/cron/job-log";
import { prisma } from "@/lib/db/prisma";
import { buildEmailPayload, type EmailJobPayload } from "@/lib/email/process";
import {
  AssignmentStatus,
  NotificationStatus,
  NotificationType,
  PeerAssignmentStatus,
  PeerReviewStatus,
  SubmissionStatus,
  UserRole,
} from "@/lib/generated/prisma/enums";
import { isoWeekKey, jobKeys } from "@/lib/jobs/idempotency";
import { appUrl, enqueueEmails } from "@/lib/jobs/qstash";
import type { ScheduledJobName } from "@/lib/jobs/queues";
import { formatDateTimeTr } from "@/lib/utils/date";
import { generatePeerAssignments } from "@/server/services/peer-assignment-service";

function positiveDays(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function processAssignmentStatuses() {
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

    const changed = await prisma.$transaction(async (tx) => {
      // Eski statüyü koşula eklemek, aynı cron iki kez çalışsa bile yalnızca bir
      // worker'ın geçişin yan etkilerini uygulamasını sağlar.
      const update = await tx.assignment.updateMany({
        where: { id: assignment.id, status: assignment.status },
        data: { status: expected },
      });
      if (update.count === 0) return false;

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
      return true;
    });

    if (!changed) continue;
    transitions.push({ id: assignment.id, from: assignment.status, to: expected });

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
}

async function sendSubmissionReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const assignments = await prisma.assignment.findMany({
    where: {
      status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.SUBMISSION_OPEN] },
      submissionEndsAt: { gt: now, lte: windowEnd },
    },
    select: { id: true, title: true, courseId: true, submissionEndsAt: true },
    orderBy: { submissionEndsAt: "asc" },
    take: 500,
  });

  const courseIds = [...new Set(assignments.map((assignment) => assignment.courseId))];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [members, submitted] = await Promise.all([
    courseIds.length === 0
      ? Promise.resolve([])
      : prisma.courseMembership.findMany({
          where: {
            courseId: { in: courseIds },
            leftAt: null,
            role: "STUDENT",
            user: { role: UserRole.STUDENT, status: "ACTIVE" },
          },
          select: {
            courseId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
    assignmentIds.length === 0
      ? Promise.resolve([])
      : prisma.submission.findMany({
          where: {
            assignmentId: { in: assignmentIds },
            status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LOCKED] },
          },
          select: { assignmentId: true, studentId: true },
        }),
  ]);

  const membersByCourse = new Map<string, typeof members>();
  for (const member of members) {
    const list = membersByCourse.get(member.courseId) ?? [];
    list.push(member);
    membersByCourse.set(member.courseId, list);
  }
  const submittedKeys = new Set(
    submitted.map((item) => `${item.assignmentId}:${item.studentId}`),
  );

  const payloads: EmailJobPayload[] = [];
  for (const assignment of assignments) {
    for (const { user } of membersByCourse.get(assignment.courseId) ?? []) {
      if (submittedKeys.has(`${assignment.id}:${user.id}`)) continue;
      payloads.push(
        buildEmailPayload({
          jobKey: jobKeys.submissionReminder(assignment.id, user.id),
          type: NotificationType.SUBMISSION_REMINDER,
          to: user.email,
          recipientUserId: user.id,
          data: {
            name: user.name,
            assignmentTitle: assignment.title,
            endsAt: formatDateTimeTr(assignment.submissionEndsAt),
            assignmentUrl: `${appUrl()}/student/assignments/${assignment.id}`,
          },
        }),
      );
    }
  }

  await enqueueEmails(payloads);
  return { assignments: assignments.length, reminders: payloads.length };
}

async function sendReviewReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  let cursor: string | undefined;
  let pendingTasks = 0;
  let reminders = 0;

  do {
    const pending = await prisma.peerAssignment.findMany({
      where: {
        status: { in: [PeerAssignmentStatus.ASSIGNED, PeerAssignmentStatus.IN_PROGRESS] },
        assignment: { reviewEndsAt: { gt: now, lte: windowEnd } },
      },
      include: {
        assignment: { select: { title: true, reviewEndsAt: true } },
        reviewer: { select: { id: true, name: true, email: true, status: true } },
      },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (pending.length === 0) break;

    pendingTasks += pending.length;
    const payloads: EmailJobPayload[] = [];
    for (const peerAssignment of pending) {
      if (peerAssignment.reviewer.status !== "ACTIVE") continue;
      payloads.push(
        buildEmailPayload({
          jobKey: jobKeys.reviewReminder(peerAssignment.id),
          type: NotificationType.REVIEW_REMINDER,
          to: peerAssignment.reviewer.email,
          recipientUserId: peerAssignment.reviewer.id,
          data: {
            name: peerAssignment.reviewer.name,
            assignmentTitle: peerAssignment.assignment.title,
            endsAt: formatDateTimeTr(peerAssignment.assignment.reviewEndsAt),
            reviewUrl: `${appUrl()}/student/reviews/${peerAssignment.id}`,
          },
        }),
      );
    }
    await enqueueEmails(payloads);
    reminders += payloads.length;
    cursor = pending.at(-1)!.id;
    if (pending.length < 500) break;
  } while (cursor);

  return { pendingTasks, reminders };
}

async function sendWeeklyTeacherReport() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const week = isoWeekKey(now);
  const [teachers, newSubmissions, completedReviews, activeAssignments, newStudents] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.TEACHER, status: "ACTIVE" },
        select: { id: true, email: true },
      }),
      prisma.submission.count({
        where: {
          submittedAt: { gte: weekAgo },
          status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LOCKED] },
        },
      }),
      prisma.peerReview.count({
        where: { status: PeerReviewStatus.SUBMITTED, submittedAt: { gte: weekAgo } },
      }),
      prisma.assignment.findMany({
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
        select: { title: true, status: true },
      }),
      prisma.user.count({
        where: { role: UserRole.STUDENT, createdAt: { gte: weekAgo } },
      }),
    ]);

  const statusTr: Record<string, string> = {
    PUBLISHED: "Yayında",
    SUBMISSION_OPEN: "Teslim açık",
    SUBMISSION_CLOSED: "Teslim kapandı",
    REVIEW_OPEN: "Değerlendirme açık",
  };
  const lines = [
    `Son 7 günde ${newSubmissions} teslim yapıldı, ${completedReviews} akran değerlendirmesi tamamlandı.`,
    `Yeni kayıt olan öğrenci: ${newStudents}`,
    activeAssignments.length > 0
      ? `Aktif ödevler: ${activeAssignments
          .map((assignment) =>
            `${assignment.title} (${statusTr[assignment.status] ?? assignment.status})`,
          )
          .join(", ")}`
      : "Şu anda aktif ödev yok.",
  ];

  const payloads: EmailJobPayload[] = teachers.map((teacher) =>
    buildEmailPayload({
      jobKey: `${jobKeys.teacherWeeklyReport(week)}:${teacher.id}`,
      type: NotificationType.TEACHER_WEEKLY_REPORT,
      to: teacher.email,
      recipientUserId: teacher.id,
      data: {
        title: `Haftalık Özet (${week})`,
        lines,
        url: `${appUrl()}/teacher`,
      },
    }),
  );
  await enqueueEmails(payloads);
  return { teachers: teachers.length, week, sent: payloads.length };
}

async function cleanupExpiredData() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const jobCutoff = new Date(now.getTime() - positiveDays(process.env.JOB_LOG_RETENTION_DAYS, 90) * day);
  const notificationCutoff = new Date(
    now.getTime() - positiveDays(process.env.NOTIFICATION_LOG_RETENTION_DAYS, 180) * day,
  );
  const tokenCutoff = new Date(now.getTime() - 7 * day);
  const rateLimitCutoff = new Date(now.getTime() - day);

  const [rateLimits, sessions, resetTokens, scheduledJobs, notifications] = await prisma.$transaction([
    prisma.rateLimitEntry.deleteMany({ where: { windowStart: { lt: rateLimitCutoff } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null, lt: tokenCutoff } }],
      },
    }),
    prisma.scheduledJobLog.deleteMany({ where: { createdAt: { lt: jobCutoff } } }),
    prisma.notificationLog.deleteMany({
      where: {
        updatedAt: { lt: notificationCutoff },
        status: { in: [NotificationStatus.SENT, NotificationStatus.SKIPPED] },
      },
    }),
  ]);

  return {
    rateLimits: rateLimits.count,
    sessions: sessions.count,
    resetTokens: resetTokens.count,
    scheduledJobs: scheduledJobs.count,
    notifications: notifications.count,
  };
}

async function recoverEmailOutbox() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const staleProcessing = new Date(Date.now() - 10 * 60 * 1000);
  const orphaned = await prisma.notificationLog.findMany({
    where: {
      OR: [
        {
          attempts: 0,
          status: { in: [NotificationStatus.PENDING, NotificationStatus.FAILED] },
          scheduledFor: { lt: cutoff },
        },
        {
          status: NotificationStatus.PROCESSING,
          processingStartedAt: { lt: staleProcessing },
        },
      ],
    },
    orderBy: { scheduledFor: "asc" },
    take: 500,
  });

  const payloads: EmailJobPayload[] = [];
  for (const item of orphaned) {
    if (!item.metadata || Array.isArray(item.metadata) || typeof item.metadata !== "object") {
      continue;
    }
    payloads.push({
      jobKey: item.jobKey,
      type: item.type,
      to: item.recipientEmail,
      recipientUserId: item.recipientUserId,
      data: item.metadata as Record<string, unknown>,
    });
  }
  await enqueueEmails(payloads);
  return { found: orphaned.length, requeued: payloads.length };
}

export async function runScheduledJob(name: ScheduledJobName): Promise<object> {
  return withJobLog(name, async () => {
    switch (name) {
      case "process-assignment-statuses":
        return processAssignmentStatuses();
      case "submission-reminders":
        return sendSubmissionReminders();
      case "review-reminders":
        return sendReviewReminders();
      case "weekly-teacher-report":
        return sendWeeklyTeacherReport();
      case "maintenance-cleanup":
        return cleanupExpiredData();
      case "recover-email-outbox":
        return recoverEmailOutbox();
    }
  });
}
