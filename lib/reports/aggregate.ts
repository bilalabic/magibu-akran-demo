import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/errors";
import {
  CriterionType,
  PeerReviewStatus,
  SubmissionStatus,
  UserRole,
} from "@/lib/generated/prisma/enums";

// Rapor hesaplama çekirdeği (döküman Bölüm 18).
// Genel ortalama: kriter ortalamalarının (varsa weight ile) ağırlıklı ortalaması.

export type CriterionInfo = {
  id: string;
  title: string;
  type: CriterionType;
  order: number;
  minScore: number | null;
  maxScore: number | null;
  weight: number | null;
};

export type StudentReportRow = {
  student: { id: string; name: string; email: string };
  submission: {
    id: string;
    title: string;
    status: SubmissionStatus;
    submittedAt: Date | null;
    links: Array<{ label: string | null; url: string }>;
  } | null;
  assignedReviewCount: number; // bu öğrencinin teslimine atanan
  completedReviewCount: number; // tesliminin aldığı tamamlanmış değerlendirme
  reviewerAssignedCount: number; // öğrencinin değerlendirici olarak görevi
  reviewerCompletedCount: number; // değerlendirici olarak tamamladığı
  scoresByCriterion: Record<string, number[]>;
  averageByCriterion: Record<string, number | null>;
  textsByCriterion: Record<string, string[]>;
  overallAverage: number | null;
};

export type AssignmentReport = {
  assignment: {
    id: string;
    title: string;
    status: string;
    submissionEndsAt: Date;
    reviewEndsAt: Date;
  };
  courseName: string;
  moduleTitle: string | null;
  criteria: CriterionInfo[];
  rows: StudentReportRow[];
  classAverageByCriterion: Record<string, number | null>;
  classOverallAverage: number | null;
  stats: {
    studentCount: number;
    submittedCount: number;
    assignedReviewCount: number;
    completedReviewCount: number;
  };
};

export { average, overallFromCriterionAverages, round2 } from "@/lib/reports/math";
import { average, overallFromCriterionAverages, round2 } from "@/lib/reports/math";

export async function buildAssignmentReport(assignmentId: string): Promise<AssignmentReport> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: { select: { name: true } },
      module: { select: { title: true } },
      rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
    },
  });
  if (!assignment) {
    throw new ApiError("NOT_FOUND", "Ödev bulunamadı.");
  }

  const criteria: CriterionInfo[] = (assignment.rubric?.criteria ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    type: c.type,
    order: c.order,
    minScore: c.minScore,
    maxScore: c.maxScore,
    weight: c.weight === null ? null : Number(c.weight),
  }));

  // Dersin aktif öğrenci üyeleri (teslim etmeyenler de raporda görünür)
  const memberships = await prisma.courseMembership.findMany({
    where: {
      courseId: assignment.courseId,
      leftAt: null,
      user: { role: UserRole.STUDENT, status: "ACTIVE" },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const submissions = await prisma.submission.findMany({
    where: { assignmentId },
    include: { links: { orderBy: { sortOrder: "asc" } } },
  });
  const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));

  const peerAssignments = await prisma.peerAssignment.findMany({
    where: { assignmentId },
    include: {
      review: { include: { answers: true } },
    },
  });

  const rows: StudentReportRow[] = memberships.map(({ user }) => {
    const submission = submissionByStudent.get(user.id) ?? null;

    const incoming = submission
      ? peerAssignments.filter((pa) => pa.submissionId === submission.id)
      : [];
    const completedIncoming = incoming.filter(
      (pa) => pa.review?.status === PeerReviewStatus.SUBMITTED,
    );
    const outgoing = peerAssignments.filter((pa) => pa.reviewerId === user.id);
    const completedOutgoing = outgoing.filter(
      (pa) => pa.review?.status === PeerReviewStatus.SUBMITTED,
    );

    const scoresByCriterion: Record<string, number[]> = {};
    const textsByCriterion: Record<string, string[]> = {};
    for (const criterion of criteria) {
      scoresByCriterion[criterion.id] = [];
      textsByCriterion[criterion.id] = [];
    }
    for (const pa of completedIncoming) {
      for (const answer of pa.review?.answers ?? []) {
        if (answer.score !== null && scoresByCriterion[answer.criterionId]) {
          scoresByCriterion[answer.criterionId]!.push(answer.score);
        }
        if (answer.textValue && textsByCriterion[answer.criterionId]) {
          textsByCriterion[answer.criterionId]!.push(answer.textValue);
        }
      }
    }

    const averageByCriterion: Record<string, number | null> = {};
    for (const criterion of criteria) {
      averageByCriterion[criterion.id] = round2(average(scoresByCriterion[criterion.id]!));
    }
    const overallAverage = round2(overallFromCriterionAverages(criteria, averageByCriterion));

    return {
      student: user,
      submission: submission
        ? {
            id: submission.id,
            title: submission.title,
            status: submission.status,
            submittedAt: submission.submittedAt,
            links: submission.links.map((l) => ({ label: l.label, url: l.url })),
          }
        : null,
      assignedReviewCount: incoming.length,
      completedReviewCount: completedIncoming.length,
      reviewerAssignedCount: outgoing.length,
      reviewerCompletedCount: completedOutgoing.length,
      scoresByCriterion,
      averageByCriterion,
      textsByCriterion,
      overallAverage,
    };
  });

  // Sınıf ortalamaları
  const classAverageByCriterion: Record<string, number | null> = {};
  for (const criterion of criteria) {
    const allScores = rows.flatMap((row) => row.scoresByCriterion[criterion.id] ?? []);
    classAverageByCriterion[criterion.id] = round2(average(allScores));
  }
  const classOverallAverage = round2(
    average(rows.map((r) => r.overallAverage).filter((v): v is number => v !== null)),
  );

  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      status: assignment.status,
      submissionEndsAt: assignment.submissionEndsAt,
      reviewEndsAt: assignment.reviewEndsAt,
    },
    courseName: assignment.course.name,
    moduleTitle: assignment.module?.title ?? null,
    criteria,
    rows,
    classAverageByCriterion,
    classOverallAverage,
    stats: {
      studentCount: rows.length,
      submittedCount: rows.filter(
        (r) => r.submission && r.submission.status !== SubmissionStatus.DRAFT,
      ).length,
      assignedReviewCount: peerAssignments.length,
      completedReviewCount: peerAssignments.filter(
        (pa) => pa.review?.status === PeerReviewStatus.SUBMITTED,
      ).length,
    },
  };
}
