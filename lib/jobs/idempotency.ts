// Döküman 15.5: Her zamanlanmış iş için benzersiz jobKey üretimi.
// Bu değer NotificationLog.jobKey alanında unique tutulur; aynı işin ikinci
// çalışması mükerrer e-posta üretmez.

export const jobKeys = {
  invitation: (whitelistEntryId: string) => `invitation:${whitelistEntryId}`,
  peerAssignment: (peerAssignmentId: string) => `peer-assignment:${peerAssignmentId}`,
  // Öğrenci başına tek bildirim: aynı ödevin atama e-postası bir kez gider
  peerAssignmentBatch: (assignmentId: string, reviewerId: string) =>
    `peer-assignment:${assignmentId}:${reviewerId}`,
  submissionReminder: (assignmentId: string, userId: string) =>
    `submission-reminder:${assignmentId}:${userId}:24h`,
  reviewReminder: (peerAssignmentId: string) => `review-reminder:${peerAssignmentId}:12h`,
  studentReport: (assignmentId: string, userId: string) =>
    `student-report:${assignmentId}:${userId}`,
  teacherWeeklyReport: (isoWeek: string) => `teacher-weekly-report:${isoWeek}`,
  teacherAssignmentSummary: (assignmentId: string) =>
    `teacher-assignment-summary:${assignmentId}`,
  reviewCompletedOwner: (peerReviewId: string) => `review-completed-owner:${peerReviewId}`,
  reviewCompletedTeacher: (peerReviewId: string) => `review-completed-teacher:${peerReviewId}`,
  submissionComment: (commentId: string) => `submission-comment:${commentId}`,
  commentReply: (commentId: string) => `comment-reply:${commentId}`,
  passwordReset: (tokenId: string) => `password-reset:${tokenId}`,
} as const;

// ISO hafta anahtarı (ör. 2026-W29) — haftalık öğretmen raporu tekilliği için.
export function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
