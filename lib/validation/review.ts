import { z } from "zod";

export const reviewAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        criterionId: z.string().min(1, "Kriter kimliği gerekli."),
        score: z.number().int("Puan tam sayı olmalı.").nullable().optional(),
        textValue: z.string().trim().max(5000).nullable().optional(),
      }),
    )
    .max(50, "En fazla 50 cevap gönderilebilir."),
});

export type ReviewAnswersInput = z.infer<typeof reviewAnswersSchema>;
