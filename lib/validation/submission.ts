import { z } from "zod";

import { validateSubmissionUrl } from "@/lib/validation/url";

// FR-4.2..4.8: başlık + açıklama/odak noktası + en az bir http(s) bağlantısı.
const linkSchema = z.object({
  label: z.string().trim().max(100).optional(),
  url: z
    .string({ error: "Bağlantı gerekli." })
    .trim()
    .superRefine((value, ctx) => {
      const result = validateSubmissionUrl(value);
      if (!result.valid) {
        ctx.addIssue({ code: "custom", message: result.reason });
      }
    }),
});

export const submissionUpsertSchema = z.object({
  title: z
    .string({ error: "Başlık gerekli." })
    .trim()
    .min(3, "Başlık en az 3 karakter olmalı.")
    .max(200, "Başlık en fazla 200 karakter olabilir."),
  description: z
    .string({ error: "Açıklama ve odak noktası gerekli." })
    .trim()
    .min(10, "Açıklama en az 10 karakter olmalı.")
    .max(5000, "Açıklama en fazla 5000 karakter olabilir."),
  links: z
    .array(linkSchema)
    .min(1, "En az bir bağlantı eklemelisiniz.")
    .max(10, "En fazla 10 bağlantı eklenebilir."),
});

export const commentCreateSchema = z.object({
  content: z
    .string({ error: "Yorum içeriği gerekli." })
    .trim()
    .min(1, "Yorum boş olamaz.")
    .max(2000, "Yorum en fazla 2000 karakter olabilir."),
});

export type SubmissionUpsertInput = z.infer<typeof submissionUpsertSchema>;
