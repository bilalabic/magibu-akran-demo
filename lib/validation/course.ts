import { z } from "zod";

import { CourseRole } from "@/lib/generated/prisma/enums";

export const courseCreateSchema = z.object({
  name: z.string({ error: "Ders adı gerekli." }).trim().min(2).max(150),
  description: z.string().trim().max(2000).optional(),
});

export const courseUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "Güncellenecek en az bir alan gönderin.",
  });

export const moduleCreateSchema = z.object({
  title: z.string({ error: "Modül başlığı gerekli." }).trim().min(2).max(150),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().min(1).optional(),
});

export const moduleUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    order: z.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "Güncellenecek en az bir alan gönderin.",
  });

export const memberAddSchema = z.object({
  email: z.email({ error: "Geçerli bir e-posta adresi girin." }),
  role: z.enum(CourseRole).default(CourseRole.STUDENT),
});
