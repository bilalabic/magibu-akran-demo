export const JOB_QUEUES = {
  deadLetter: "dead-letter",
  email: "email",
  processAssignmentStatuses: "cron-process-assignment-statuses",
  submissionReminders: "cron-submission-reminders",
  reviewReminders: "cron-review-reminders",
  weeklyTeacherReport: "cron-weekly-teacher-report",
  maintenanceCleanup: "maintenance-cleanup",
  recoverEmailOutbox: "maintenance-recover-email-outbox",
} as const;

export type ScheduledJobName =
  | "process-assignment-statuses"
  | "submission-reminders"
  | "review-reminders"
  | "weekly-teacher-report"
  | "maintenance-cleanup"
  | "recover-email-outbox";

export const QUEUE_BY_SCHEDULED_JOB: Record<ScheduledJobName, string> = {
  "process-assignment-statuses": JOB_QUEUES.processAssignmentStatuses,
  "submission-reminders": JOB_QUEUES.submissionReminders,
  "review-reminders": JOB_QUEUES.reviewReminders,
  "weekly-teacher-report": JOB_QUEUES.weeklyTeacherReport,
  "maintenance-cleanup": JOB_QUEUES.maintenanceCleanup,
  "recover-email-outbox": JOB_QUEUES.recoverEmailOutbox,
};

export const SCHEDULED_JOBS: Array<{
  name: ScheduledJobName;
  cron: string;
}> = [
  { name: "process-assignment-statuses", cron: "*/2 * * * *" },
  { name: "submission-reminders", cron: "0 * * * *" },
  { name: "review-reminders", cron: "15 * * * *" },
  { name: "weekly-teacher-report", cron: "0 9 * * 1" },
  { name: "maintenance-cleanup", cron: "15 3 * * *" },
  { name: "recover-email-outbox", cron: "*/5 * * * *" },
];
