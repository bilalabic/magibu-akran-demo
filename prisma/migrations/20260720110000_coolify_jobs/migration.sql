ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' AFTER 'PENDING';

ALTER TABLE "NotificationLog"
ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE INDEX "NotificationLog_status_scheduledFor_idx"
ON "NotificationLog"("status", "scheduledFor");

CREATE INDEX "ScheduledJobLog_createdAt_idx"
ON "ScheduledJobLog"("createdAt");
