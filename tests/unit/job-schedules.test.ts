import { describe, expect, it } from "vitest";

import {
  JOB_QUEUES,
  QUEUE_BY_SCHEDULED_JOB,
  SCHEDULED_JOBS,
} from "@/lib/jobs/queues";

describe("worker job schedules", () => {
  it("uses one unique queue for every scheduled job", () => {
    const queues = Object.values(QUEUE_BY_SCHEDULED_JOB);
    expect(new Set(queues).size).toBe(queues.length);
    expect(queues).not.toContain(JOB_QUEUES.email);
    expect(queues).not.toContain(JOB_QUEUES.deadLetter);
  });

  it("defines a cron expression for every scheduled job", () => {
    expect(SCHEDULED_JOBS.map((item) => item.name).sort()).toEqual(
      Object.keys(QUEUE_BY_SCHEDULED_JOB).sort(),
    );
    expect(SCHEDULED_JOBS.every((item) => item.cron.split(" ").length === 5)).toBe(true);
  });

  it("runs the weekly report Monday at 09:00 in the worker timezone", () => {
    expect(SCHEDULED_JOBS.find((item) => item.name === "weekly-teacher-report")?.cron).toBe(
      "0 9 * * 1",
    );
  });
});
