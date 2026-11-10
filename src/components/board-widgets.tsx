import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Check, Clock, Film, UserPlus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { editorsQuery, useUpdateJob, type Job } from "@/lib/jobs";
import {
  STAGE_META, STATUSES, addDays, categoryChip, cutoffCountdown, stageBreakdown, stageOf, statusOptions,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Solid Monday-style status tile; click to pick a new status. */
export function StatusTile({ job, className }: { job: Job; className?: string }) {
  const update = useUpdateJob();
  const [open, setOpen] = useState(false);
  const opts = statusOptions(job.department);
  const list = opts.includes(job.status) ? opts : [...opts, job.status];
  return (
    <div onClick={stop}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            title={job.status}
            className={cn("flex h-8 w-full items-center justify-center truncate rounded-sm px-2 text-xs font-semibold shadow-sm transition hover:brightness-110", STAGE_META[stageOf(job.status)].tile, className)}
          >
            <span className="truncate">{job.status || "—"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid gap-1">
            {list.map((s) => (
              <button
                key={s}
                onClick={() => { update.mutate({ id: job.id, patch: { status: s } }); setOpen(false); }}
                className={cn("flex h-7 items-center justify-between rounded-sm px-2 text-left text-xs font-medium", STAGE_META[stageOf(s)].tile)}
              >
                <span className="truncate">{s}</span>
                {s === job.status && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Segmented stage battery. */
export function PipelineBattery({ jobs, className }: { jobs: { status: string | null }[]; className?: string }) {
  const parts = stageBreakdown(jobs);
  const total = jobs.length || 1;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((p) => (
          <Tooltip key={p.stage}>
            <TooltipTrigger asChild>
              <div className={cn("h-full transition-all", STAGE_META[p.stage].tile)} style={{ width: `${(p.count / total) * 100}%` }} />
            </TooltipTrigger>
            <TooltipContent className="text-xs">{STAGE_META[p.stage].label}: {p.count} ({Math.round((p.count / total) * 100)}%)</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {parts.map((p) => (
          <span key={p.stage} className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", STAGE_META[p.stage].tile)} />
            {STAGE_META[p.stage].label} <span className="font-semibold text-foreground">{p.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Live "time until 5 PM delivery cutoff" chip. */
export function CutoffClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const left = cutoffCountdown(now);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", left ? "border-warning bg-warning-soft text-foreground" : "text-muted-foreground")}>
      <Clock className="h-3.5 w-3.5" />
      {left ? <>{left} until 5 PM cutoff</> : "Past 5 PM cutoff"}
    </span>
  );
}

/** +1 / +2 day deadline bump. */
export function DeadlineShifter({ job }: { job: Job }) {
  const update = useUpdateJob();
  if (!job.due_date) return null;
  const bump = (n: number) => update.mutate({ id: job.id, patch: { due_date: addDays(job.due_date!, n) } });
  return (
    <div onClick={stop}>
      <Popover>
        <PopoverTrigger asChild>
          <button aria-label="Shift deadline" title="Shift deadline" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 p-1.5" align="start">
          {[1, 2, 3].map((n) => (
            <Button key={n} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => bump(n)}>+{n} day{n > 1 ? "s" : ""}</Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CategoryChip({ job }: { job: Job }) {
  const c = categoryChip(job.category, job.department);
  return <span title={job.category ?? ""} className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", STAGE_META[c.tone].tile)}>{c.label}</span>;
}

/** Floating bar for bulk actions on selected jobs. */
export function BatchBar({ jobs, onClear }: { jobs: Job[]; onClear: () => void }) {
  const update = useUpdateJob();
  const { data: editors = [] } = useQuery(editorsQuery);
  if (!jobs.length) return null;
  const apply = (patch: (j: Job) => Partial<Job> | null) => {
    jobs.forEach((j) => { const p = patch(j); if (p) update.mutate({ id: j.id, patch: p }); });
    onClear();
  };
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-2xl">
        <span className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">{jobs.length}</span>
        <span className="text-sm font-medium">selected</span>
        <span className="mx-1 h-5 w-px bg-border" />
        <Select onValueChange={(v) => apply(() => ({ editor: v === "__none" ? null : v }))}>
          <SelectTrigger className="h-8 w-40 text-xs"><UserPlus className="h-3.5 w-3.5" /><SelectValue placeholder="Assign editor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Unassigned</SelectItem>
            {editors.filter((e) => e.active).map((e) => <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => apply((j) => stageOf(j.status) === "shoot" ? { status: j.department === "Ongoing" ? "Ready to Edit" : "Ready to edit" } : null)}>
          <Film className="h-3.5 w-3.5" /> Footage received
        </Button>
        <Select onValueChange={(v) => apply(() => ({ status: v }))}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Change status" /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Clear selection" onClick={onClear}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
