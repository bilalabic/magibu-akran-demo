import { requireTeacher } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { paginatedResult, toSkipTake } from "@/lib/validation/common";
import { whitelistCreateSchema, whitelistListQuerySchema } from "@/lib/validation/whitelist";
import { addWhitelistEntry } from "@/server/services/whitelist-service";

export const GET = withErrorHandling(async (req) => {
  await requireTeacher();

  const url = new URL(req.url);
  const query = whitelistListQuerySchema.parse(Object.fromEntries(url.searchParams));

  const where: Prisma.WhitelistEntryWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.whitelistEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      include: { user: { select: { id: true, name: true, lastLoginAt: true } } },
    }),
    prisma.whitelistEntry.count({ where }),
  ]);

  return ok(paginatedResult(items, total, query));
});

export const POST = withErrorHandling(async (req) => {
  const teacher = await requireTeacher();
  const body = await parseJsonBody(req, whitelistCreateSchema);

  const entry = await addWhitelistEntry({
    email: body.email,
    name: body.name ?? null,
    role: body.role,
    createdById: teacher.id,
  });

  return ok({ entry }, { status: 201 });
});
