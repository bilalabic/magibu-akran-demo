import { z } from "zod";

import { UserRole, WhitelistStatus } from "@/lib/generated/prisma/enums";
import { paginationSchema } from "@/lib/validation/common";

export const whitelistCreateSchema = z.object({
  email: z.email({ error: "Geçerli bir e-posta adresi girin." }).max(254),
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(UserRole).default(UserRole.STUDENT),
});

export const whitelistUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).nullable().optional(),
    role: z.enum(UserRole).optional(),
    // REVOKED bir kaydı yeniden PENDING yapmak için
    status: z.literal(WhitelistStatus.PENDING).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "Güncellenecek en az bir alan gönderin.",
  });

export const whitelistListQuerySchema = paginationSchema.extend({
  status: z.enum(WhitelistStatus).optional(),
  search: z.string().trim().max(254).optional(),
});
