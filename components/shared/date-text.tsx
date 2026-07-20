"use client";

import { formatDateTimeTr } from "@/lib/utils/date";

// Tarihler DB'de UTC; ekranda Europe/Istanbul gösterilir.
export function DateText({ value }: { value: string | Date | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <time dateTime={new Date(value).toISOString()}>{formatDateTimeTr(value)}</time>;
}
