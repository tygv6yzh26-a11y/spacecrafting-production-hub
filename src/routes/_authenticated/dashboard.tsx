import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EditorSelect, JobLinks, NextActionButtons, RushBadge } from "@/components/job-controls";
import { JobDialog } from "@/components/job-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, ClipboardCopy, CheckCheck, Clock, Film, Package, RotateCcw, Upload } from "lucide-react";
import { jobsQuery, todayISO, formatDate, type Job } from "@/lib/jobs";
import { buildBriefing, STAGE_META, stageOf, timingOf, isClosed, departmentLabel, type Stage } from "@/lib/workflow";
import { StatusBadge, TimingBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Spacecrafting Video" }, { name: "description", content: "Morning overview of video production." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: Dashboard,
});

type AttentionReason = "Overdue" | "Due today" | "At risk" | "Waiting on footage" | "Awaiting QC" | "Needs revision";
const REASON_ORDER: AttentionReason[] = ["Overdue", "Due today", "At risk", "Needs revision", "Awaiting QC", "Waiting on footage"];

function attentionReason(j: Job, today: string): AttentionReason | null {
  const t = timingOf(j, today);
  if (t === "overdue") return "Overdue";
  if (t === "due_today") return "Due today";
  if (t === "at_risk") return "At risk";
  const s = stageOf(j.status);
  if (s === "revision") return "Needs revision";
  if (s === "qc") return "Awaiting QC";
  if (s === "shoot" && /footage|photos/i.test(j.status)) return "Waiting on footage";
  return null;
}

function Dashboard() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const today = todayISO();
  const [open, setOpen] = useState<Job | null>(null);
  const copyBriefing = async () => {
    const label = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    try {
      await navigator.clipboard.writeText(buildBriefing(jobs, today, label));
      toast.success("Morning briefing copied", { description: "Paste it into Slack, email or a text." });
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  const monthPrefix = today.slice(0, 7);

  const stats = useMemo(() => {
    const active = jobs.filter((j) => !isClosed(j.status));
    return {
      active: active.length,
      editing: jobs.filter((j) => stageOf(j.status) === "editing").length,
      qc: jobs.filter((j) => stageOf(j.status) === "qc").length,
      revision: jobs.filter((j) => stageOf(j.status) === "revision").length,
      overdue: jobs.filter((j) => timingOf(j, today) === "overdue").length,
      delivered: jobs.filter((j) => stageOf(j.status) === "delivered" && ((j.due_date ?? j.shoot_date ?? "").startsWith(monthPrefix))).length,
    };
  }, [jobs, today, monthPrefix]);

  const attention = useMemo(() => {
    const rows = jobs.map((j) => ({ j, r: attentionReason(j, today) })).filter((x): x is { j: Job; r: AttentionReason } => !!x.r);
    rows.sort((a, b) => REASON_ORDER.indexOf(a.r) - REASON_ORDER.indexOf(b.r) || (a.j.due_date ?? "9").localeCompare(b.j.due_date ?? "9"));
    return rows;
  }, [jobs, today]);

  const byStage = useMemo(() => {
    const order: Stage[] = ["shoot", "ready", "editing", "client", "qc", "revision", "qc_complete"];
    const active = jobs.filter((j) => !isClosed(j.status));
    return order.map((s) => ({ stage: s, count: active.filter((j) => stageOf(j.status) === s).length }));
  }, [jobs]);
  const maxStage = Math.max(1, ...byStage.map((s) => s.count));

  const byDept = useMemo(() => {
    const m = new Map<string, number>();
    jobs.filter((j) => !isClosed(j.status)).forEach((j) => m.set(j.department, (m.get(j.department) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const editors = useMemo(() => {
    const m = new Map<string, Job[]>();
    jobs.filter((j) => !isClosed(j.status)).forEach((j) => {
      const k = j.editor ?? "Unassigned";
      m.set(k, [...(m.get(k) ?? []), j]);
    });
    return [...m.entries()]
      .map(([name, list]) => ({ name, list: list.sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9")), overdue: list.filter((j) => timingOf(j, today) === "overdue").length }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [jobs, today]);

  const cards = [
    { label: "Active jobs", value: stats.active, icon: Package, to: "/jobs" as const },
    { label: "Being edited", value: stats.editing, icon: Film, to: "/editing" as const },
    { label: "Awaiting QC", value: stats.qc, icon: CheckCheck, to: "/qc" as const },
    { label: "Needs revisions", value: stats.revision, icon: RotateCcw, to: "/revisions" as const },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, to: "/jobs" as const, danger: true },
    { label: "Delivered this month", value: stats.delivered, icon: Upload, to: "/delivery" as const },
  ];

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border bg-card p-10 text-center shadow-card">
        <h1 className="text-lg font-semibold">No jobs yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Import the master spreadsheet to bring in your existing jobs, or add jobs from Production Jobs.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/import" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Import spreadsheet</Link>
          <Link to="/jobs" className="rounded-md border px-4 py-2 text-sm font-medium">Production Jobs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Morning Overview</h1>
          <p className="text-sm text-muted-foreground">Where every video job stands right now. Click a job to edit it.</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyBriefing}><ClipboardCopy className="h-4 w-4" /> Copy morning briefing</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className={cn("rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-primary/40", c.danger && c.value > 0 && "border-overdue/40 bg-overdue-soft")}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {c.label}
              <c.icon className={cn("h-4 w-4", c.danger && c.value > 0 && "text-overdue")} />
            </div>
            <div className={cn("mt-2 text-3xl font-semibold tabular-nums", c.danger && c.value > 0 && "text-overdue")}>{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-lg border bg-card shadow-card xl:col-span-3">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Today's Attention</h2>
            </div>
            <span className="text-xs text-muted-foreground">{attention.length} jobs</span>
          </div>
          <div className="flex flex-wrap gap-2 border-b px-4 py-2 text-xs">
            {REASON_ORDER.map((r) => {
              const n = attention.filter((a) => a.r === r).length;
              return <span key={r} className={cn("rounded-full border px-2 py-0.5", n === 0 && "opacity-40", r === "Overdue" && n > 0 && "border-overdue text-overdue")}>{r} · {n}</span>;
            })}
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {attention.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing needs attention. 🎬</p>}
            <ul className="divide-y">
              {attention.slice(0, 80).map(({ j, r }) => (
                <li key={j.id} onClick={() => setOpen(j)} className={cn("flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm hover:bg-muted/50", r === "Overdue" && "bg-overdue-soft")}>
                  <span className={cn("w-24 shrink-0 text-xs font-medium", r === "Overdue" ? "text-overdue" : "text-muted-foreground")}>{r}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-medium"><RushBadge job={j} /><span className="truncate">{j.address ?? j.project_name}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{departmentLabel(j.department)} · {j.category} · {j.client}</div>
                  </div>
                  <StatusBadge status={j.status} className="hidden max-w-[160px] md:inline-flex" />
                  <span className="w-16 shrink-0 text-right text-xs">{formatDate(j.due_date)}</span>
                  <div className="flex w-full items-center justify-end gap-1.5 pl-[108px]">
                    <JobLinks job={j} />
                    <NextActionButtons job={j} />
                    <EditorSelect job={j} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-lg border bg-card p-4 shadow-card">
            <h2 className="text-sm font-semibold">Production Overview</h2>
            <p className="text-xs text-muted-foreground">Active jobs by workflow stage</p>
            <div className="mt-4 space-y-2.5">
              {byStage.map(({ stage, count }) => (
                <div key={stage} className="flex items-center gap-3 text-xs">
                  <span className="w-36 shrink-0 text-muted-foreground">{STAGE_META[stage].label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div className={cn("h-full rounded", STAGE_META[stage].tone)} style={{ width: `${(count / maxStage) * 100}%`, minWidth: count ? 6 : 0 }} />
                  </div>
                  <span className="w-8 text-right font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3 text-xs">
              {byDept.map(([d, n]) => <span key={d} className="rounded border px-2 py-0.5">{departmentLabel(d)} <b className="tabular-nums">{n}</b></span>)}
            </div>
          </section>

          <section className="rounded-lg border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Editor Workload</h2>
              <Link to="/workload" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <ul className="divide-y">
              {editors.slice(0, 8).map((e) => (
                <li key={e.name}>
                  <Link to="/workload" hash={`editor-${e.name}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                  <span className="w-28 truncate font-medium">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{e.list.length} active</span>
                  {e.overdue > 0 && <span className="text-xs font-medium text-overdue">{e.overdue} overdue</span>}
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> next {formatDate(e.list.find((j) => j.due_date)?.due_date)}
                  </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <JobDialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} job={open} />
    </div>
  );
}

export { TimingBadge };
