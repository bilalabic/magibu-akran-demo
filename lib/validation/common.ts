import { z } from "zod";

// Liste endpoint'leri için ortak pagination şeması (NFR-2.4).
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function toSkipTake(input: PaginationInput): { skip: number; take: number } {
  return { skip: (input.page - 1) * input.pageSize, take: input.pageSize };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  { page, pageSize }: PaginationInput,
) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export const cuidSchema = z.string().min(1, "Kimlik değeri gerekli.");
