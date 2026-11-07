import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { jobsQuery, editorsQuery, todayISO, formatDate, type Job } from "@/lib/jobs";
import { isClosed, stageOf, timingOf, departmentLabel } from "@/lib/workflow";
import { StatusBadge, TimingBadge } from "@/components/status-badge";
import { EditorSelect, JobLinks, NextActionButtons, RushBadge } from "@/components/job-controls";
import { JobDialog } from "@/components/job-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workload")({
  head: () => ({ meta: [{ title: "Editor Workload — Spacecrafting Video" }, { name: "description", content: "Balance and reassign active jobs across editors." }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(jobsQuery), context.queryClient.ensureQueryData(editorsQuery)]),
  component: Workload,
});

const byDue = (a: Job, b: Job) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9");

function Workload() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const { data: editors } = useSuspenseQuery(editorsQuery);
  const today = todayISO();
  const [open, setOpen] = useState<Job | null>(null);

  const { unassigned, groups } = useMemo(() => {
    const active = jobs.filter((j) => !isClosed(j.status));
    const m = new Map<string, Job[]>();
    editors.filter((e) => e.active).forEach((e) => m.set(e.name, []));
    active.filter((j) => j.editor).forEach((j) => m.set(j.editor!, [...(m.get(j.editor!) ?? []), j]));
    return {
      unassigned: active.filter((j) => !j.editor).sort(byDue),
      groups: [...m.entries()].map(([name, list]) => ({ name, list: list.sort(byDue) })).sort((a, b) => b.list.length - a.list.length),
    };
  }, [jobs, editors]);

  const Row = ({ j }: { j: Job }) => {
    const t = timingOf(j, today);
    return (
      <li onClick={() => setOpen(j)} className={cn("cursor-pointer space-y-1.5 px-4 py-2 text-xs hover:bg-muted/50", t === "overdue" && "bg-overdue-soft")}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-sm"><RushBadge job={j} /><span className="truncate">{j.address ?? j.project_name}</span></div>
            <div className="truncate text-muted-foreground">{departmentLabel(j.department)} · {j.category} · shot {formatDate(j.shoot_date)}</div>
          </div>
          <div className="w-16 shrink-0 text-right">
            <div className={cn(t === "overdue" && "font-medium text-overdue")}>{formatDate(j.due_date)}</div>
            <TimingBadge timing={t} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={j.status} className="max-w-[150px]" />
          <JobLinks job={j} />
          <div className="ml-auto flex items-center gap-1.5">
            <NextActionButtons job={j} />
            <EditorSelect job={j} />
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Editor Workload</h1>
        <p className="text-sm text-muted-foreground">Reassign jobs with the editor dropdown on any job. Click a job to edit details.</p>
      </div>

      <section className={cn("rounded-lg border bg-card shadow-card", unassigned.length > 0 && "border-warning")}>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Inbox className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Unassigned shoots</h2>
          <span className="text-xs text-muted-foreground">{unassigned.length} waiting for an editor</span>
        </div>
        {unassigned.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Every active job has an editor.</p>
        ) : (
          <ul className="grid max-h-96 divide-y overflow-y-auto lg:grid-cols-2 lg:divide-y-0">{unassigned.map((j) => <Row key={j.id} j={j} />)}</ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {groups.map((g) => {
          const overdue = g.list.filter((j) => timingOf(j, today) === "overdue").length;
          const editing = g.list.filter((j) => stageOf(j.status) === "editing").length;
          return (
            <section key={g.name} id={`editor-${g.name}`} className="scroll-mt-4 rounded-lg border bg-card shadow-card">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{g.name.slice(0, 2).toUpperCase()}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.list.length} active · {editing} editing</div>
                </div>
                {overdue > 0 && <span className="rounded bg-overdue px-2 py-0.5 text-xs font-medium text-destructive-foreground">{overdue} overdue</span>}
              </div>
              {g.list.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No active jobs — available.</p>
              ) : (
                <ul className="max-h-96 divide-y overflow-y-auto">{g.list.map((j) => <Row key={j.id} j={j} />)}</ul>
              )}
            </section>
          );
        })}
      </div>
      <JobDialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} job={open} />
    </div>
  );
}
