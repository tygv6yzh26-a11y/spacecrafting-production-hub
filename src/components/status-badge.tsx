import { cn } from "@/lib/utils";
import { STAGE_META, stageOf, type Timing } from "@/lib/workflow";

export function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  const stage = stageOf(status);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-xs font-medium",
        STAGE_META[stage].tone,
        className,
      )}
      title={status ?? ""}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      <span className="truncate">{status || "—"}</span>
    </span>
  );
}

export function TimingBadge({ timing }: { timing: Timing }) {
  if (timing === "overdue")
    return <span className="rounded bg-overdue px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">Overdue</span>;
  if (timing === "due_today")
    return <span className="rounded bg-warning px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">Due today</span>;
  if (timing === "at_risk")
    return <span className="rounded border border-warning bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">At risk</span>;
  return null;
}
