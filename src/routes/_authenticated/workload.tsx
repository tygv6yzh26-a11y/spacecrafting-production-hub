import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { jobsQuery, todayISO, formatDate, type Job } from "@/lib/jobs";
import { isClosed, stageOf, timingOf, departmentLabel } from "@/lib/workflow";
import { StatusBadge, TimingBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workload")({
  head: () => ({ meta: [{ title: "Editor Workload — Spacecrafting Video" }, { name: "description", content: "Active jobs and deadlines per editor." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: Workload,
});

function Workload() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const today = todayISO();
  const groups = useMemo(() => {
    const m = new Map<string, Job[]>();
    jobs.filter((j) => !isClosed(j.status)).forEach((j) => {
      const k = j.editor ?? "Unassigned";
      m.set(k, [...(m.get(k) ?? []), j]);
    });
    return [...m.entries()]
      .map(([name, list]) => ({ name, list: list.sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9")) }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [jobs]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Editor Workload</h1>
        <p className="text-sm text-muted-foreground">Active (not delivered or canceled) jobs per editor, soonest deadline first.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {groups.map((g) => {
          const overdue = g.list.filter((j) => timingOf(j, today) === "overdue").length;
          const editing = g.list.filter((j) => stageOf(j.status) === "editing").length;
          return (
            <section key={g.name} className="rounded-lg border bg-card shadow-card">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{g.name.slice(0, 2).toUpperCase()}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.list.length} active · {editing} editing{overdue ? "" : ""}</div>
                </div>
                {overdue > 0 && <span className="rounded bg-overdue px-2 py-0.5 text-xs font-medium text-destructive-foreground">{overdue} overdue</span>}
              </div>
              <ul className="max-h-80 divide-y overflow-y-auto">
                {g.list.map((j) => {
                  const t = timingOf(j, today);
                  return (
                    <li key={j.id} className={cn("flex items-center gap-2 px-4 py-2 text-xs", t === "overdue" && "bg-overdue-soft")}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{j.address ?? j.project_name}</div>
                        <div className="truncate text-muted-foreground">{departmentLabel(j.department)} · {j.category}</div>
                      </div>
                      <StatusBadge status={j.status} className="max-w-[140px]" />
                      <div className="w-16 text-right">
                        <div className={cn(t === "overdue" && "font-medium text-overdue")}>{formatDate(j.due_date)}</div>
                        <TimingBadge timing={t} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
