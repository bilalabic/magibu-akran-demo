import { describe, expect, it } from "vitest";

import { isoWeekKey, jobKeys } from "@/lib/jobs/idempotency";

// Döküman 15.5: jobKey formatları
describe("jobKeys", () => {
  it("dökümandaki formatları üretir", () => {
    expect(jobKeys.submissionReminder("a1", "u1")).toBe("submission-reminder:a1:u1:24h");
    expect(jobKeys.reviewReminder("pa1")).toBe("review-reminder:pa1:12h");
    expect(jobKeys.invitation("w1")).toBe("invitation:w1");
    expect(jobKeys.peerAssignment("pa1")).toBe("peer-assignment:pa1");
    expect(jobKeys.studentReport("a1", "u1")).toBe("student-report:a1:u1");
  });

  it("aynı girdi için deterministiktir (idempotency anahtarı)", () => {
    expect(jobKeys.submissionReminder("a", "b")).toBe(jobKeys.submissionReminder("a", "b"));
  });

  it("farklı girdiler farklı anahtar üretir", () => {
    expect(jobKeys.reviewReminder("x")).not.toBe(jobKeys.reviewReminder("y"));
  });
});

describe("isoWeekKey", () => {
  it("ISO hafta anahtarı üretir", () => {
    expect(isoWeekKey(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-W02");
    expect(isoWeekKey(new Date(Date.UTC(2026, 6, 19)))).toBe("2026-W29");
  });

  it("yıl sınırında doğru yıla bağlar", () => {
    // 2027-01-01 Cuma → 2026'nın 53. haftası
    expect(isoWeekKey(new Date(Date.UTC(2027, 0, 1)))).toBe("2026-W53");
  });
});
