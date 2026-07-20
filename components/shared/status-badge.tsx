import { Badge } from "@/components/ui/badge";
import {
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  PEER_ASSIGNMENT_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
  WHITELIST_STATUS_LABELS,
} from "@/lib/constants/labels";
import { cn } from "@/lib/utils";

export function AssignmentStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", ASSIGNMENT_STATUS_COLORS[status])}
    >
      {ASSIGNMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    LOCKED: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  };
  return (
    <Badge variant="secondary" className={cn("font-medium", colors[status])}>
      {SUBMISSION_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function PeerAssignmentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <Badge variant="secondary" className={cn("font-medium", colors[status])}>
      {PEER_ASSIGNMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function WhitelistStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    REGISTERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    REVOKED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <Badge variant="secondary" className={cn("font-medium", colors[status])}>
      {WHITELIST_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
