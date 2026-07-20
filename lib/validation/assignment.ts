import { z } from "zod";

import { AssignmentStatus, CriterionType } from "@/lib/generated/prisma/enums";
import { paginationSchema } from "@/lib/validation/common";

const dateSchema = z.coerce.date({ error: "Geçerli bir tarih girin." });

const assignmentDatesShape = {
  submissionStartsAt: dateSchema,
  submissionEndsAt: dateSchema,
  reviewStartsAt: dateSchema,
  reviewEndsAt: dateSchema,
};

function validateDateOrder(value: {
  submissionStartsAt: Date;
  submissionEndsAt: Date;
  reviewStartsAt: Date;
  reviewEndsAt: Date;
}): boolean {
  return (
    value.submissionStartsAt < value.submissionEndsAt &&
    value.submissionEndsAt <= value.reviewStartsAt &&
    value.reviewStartsAt < value.reviewEndsAt
  );
}

export const DATE_ORDER_MESSAGE =
  "Tarih sırası geçersiz: teslim başlangıcı < teslim bitişi ≤ değerlendirme başlangıcı < değerlendirme bitişi olmalı.";

export const assignmentCreateSchema = z
  .object({
    title: z.string({ error: "Ödev başlığı gerekli." }).trim().min(2).max(200),
    description: z.string({ error: "Ödev açıklaması gerekli." }).trim().min(10).max(10000),
    linkRules: z.string().trim().max(2000).optional(),
    courseId: z.string().min(1, "Ders seçilmelidir."),
    moduleId: z.string().min(1).nullable().optional(),
    requiredReviewCount: z.number().int().min(1).max(5).default(2),
    isAnonymous: z.boolean().default(true),
    ...assignmentDatesShape,
  })
  .refine(validateDateOrder, { error: DATE_ORDER_MESSAGE });

export const assignmentUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().min(10).max(10000).optional(),
    linkRules: z.string().trim().max(2000).nullable().optional(),
    moduleId: z.string().min(1).nullable().optional(),
    requiredReviewCount: z.number().int().min(1).max(5).optional(),
    isAnonymous: z.boolean().optional(),
    submissionStartsAt: dateSchema.optional(),
    submissionEndsAt: dateSchema.optional(),
    reviewStartsAt: dateSchema.optional(),
    reviewEndsAt: dateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "Güncellenecek en az bir alan gönderin.",
  });

export const assignmentListQuerySchema = paginationSchema.extend({
  courseId: z.string().min(1).optional(),
  status: z.enum(AssignmentStatus).optional(),
});

// Rubrik: FR-7.2 sayısal + metinsel kriterler; FR-7.4 varsayılan aralık 1-10.
const criterionSchema = z
  .object({
    id: z.string().min(1).optional(), // mevcut kriter güncellemesi için
    title: z.string({ error: "Kriter başlığı gerekli." }).trim().min(2).max(200),
    description: z.string().trim().max(1000).nullable().optional(),
    type: z.enum(CriterionType),
    required: z.boolean().default(true),
    minScore: z.number().int().min(0).max(100).nullable().optional(),
    maxScore: z.number().int().min(1).max(100).nullable().optional(),
    weight: z.number().min(0).max(100).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === CriterionType.SCORE) {
      const min = value.minScore ?? 1;
      const max = value.maxScore ?? 10;
      if (min >= max) {
        ctx.addIssue({
          code: "custom",
          message: "Sayısal kriterde minimum puan maksimumdan küçük olmalı.",
        });
      }
    }
  });

export const rubricUpsertSchema = z.object({
  title: z.string({ error: "Rubrik başlığı gerekli." }).trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  criteria: z
    .array(criterionSchema)
    .min(1, "En az bir kriter gerekli.")
    .max(20, "En fazla 20 kriter eklenebilir."),
});

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type RubricUpsertInput = z.infer<typeof rubricUpsertSchema>;
