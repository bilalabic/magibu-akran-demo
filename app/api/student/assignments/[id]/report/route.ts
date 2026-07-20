import { requireStudent } from "@/lib/auth/authorization";
import { isAtOrAfter } from "@/lib/assignments/status";
import { prisma } from "@/lib/db/prisma";
import { ApiError, ok, withErrorHandling } from "@/lib/errors";
import {
  AssignmentStatus,
  CriterionType,
  PeerReviewStatus,
} from "@/lib/generated/prisma/enums";
import {
  average,
  overallFromCriterionAverages,
  round2,
} from "@/lib/reports/aggregate";
import {
  assertCanViewAssignment,
  getAssignmentOrThrow,
} from "@/server/services/assignment-access";

type Params = { id: string };

// Öğrenci sonuç karnesi (döküman Bölüm 18): kriter bazlı puanlar, ortalamalar,
// anonim metin geri bildirimleri, değerlendirme sayısı.
// FR-7.10: değerlendiren kimliği asla yer almaz.
export const GET = withErrorHandling<Params>(async (_req, { params }) => {
  const student = await requireStudent();
  const { id } = await params;

  const assignment = await getAssignmentOrThrow(id);
  await assertCanViewAssignment(student, assignment);

  if (!isAtOrAfter(assignment.status, AssignmentStatus.REVIEW_CLOSED)) {
    throw new ApiError(
      "BUSINESS_RULE",
      "Sonuçlar, değerlendirme süreci kapandıktan sonra görüntülenebilir.",
    );
  }

  const submission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
  });
  if (!submission) {
    return ok({
      report: {
        assignment: { id: assignment.id, title: assignment.title, status: assignment.status },
        hasSubmission: false,
        reviewCount: 0,
        criteria: [],
        overallAverage: null,
      },
    });
  }

  const criteria = await prisma.rubricCriterion.findMany({
    where: { rubric: { assignmentId: id } },
    orderBy: { order: "asc" },
  });

  const completedReviews = await prisma.peerReview.findMany({
    where: {
      status: PeerReviewStatus.SUBMITTED,
      peerAssignment: { submissionId: submission.id },
    },
    include: { answers: true },
  });

  const criteriaInfo = criteria.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    type: c.type,
    minScore: c.minScore,
    maxScore: c.maxScore,
    weight: c.weight === null ? null : Number(c.weight),
  }));

  const averageByCriterion: Record<string, number | null> = {};
  const results = criteriaInfo.map((criterion) => {
    if (criterion.type === CriterionType.SCORE) {
      const scores = completedReviews
        .flatMap((review) => review.answers)
        .filter((a) => a.criterionId === criterion.id && a.score !== null)
        .map((a) => a.score as number);
      const avg = round2(average(scores));
      averageByCriterion[criterion.id] = avg;
      return { ...criterion, scores, average: avg, texts: [] as string[] };
    }
    const texts = completedReviews
      .flatMap((review) => review.answers)
      .filter((a) => a.criterionId === criterion.id && a.textValue)
      .map((a) => a.textValue as string);
    averageByCriterion[criterion.id] = null;
    return { ...criterion, scores: [] as number[], average: null, texts };
  });

  const overallAverage = round2(
    overallFromCriterionAverages(criteriaInfo, averageByCriterion),
  );

  return ok({
    report: {
      assignment: { id: assignment.id, title: assignment.title, status: assignment.status },
      hasSubmission: true,
      submission: {
        id: submission.id,
        title: submission.title,
        status: submission.status,
        submittedAt: submission.submittedAt,
      },
      reviewCount: completedReviews.length,
      criteria: results,
      overallAverage,
    },
  });
});
