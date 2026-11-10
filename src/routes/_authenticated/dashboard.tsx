import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EditorSelect, JobLinks, NextActionButtons, RushBadge } from "@/components/job-controls";
import { CategoryChip, CutoffClock, PipelineBattery, StatusTile } from "@/components/board-widgets";
import { JobDialog } from "@/components/job-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarCheck, CheckCheck, ClipboardCopy, Clock, Camera, Film, RotateCcw, Upload, StickyNote, UserX } from "lucide-react";
import { jobsQuery, todayISO, formatDate, type Job } from "@/lib/jobs";
import { buildBriefing, capacityLevel, departmentLabel, isClosed, recentShootDates, stageOf, timingOf, type CapacityLevel } from "@/lib/workflow";
import { StatusBadge, TimingBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Morning Dashboard — Spacecrafting Video" },
      { name: "description", content: "Yesterday's shoots, today's deliveries and editor capacity at a glance." },
      { property: "og:title", content: "Morning Dashboard — Spacecrafting Video" },
      { property: "og:description", content: "Yesterday's shoots, today's deliveries and editor capacity at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: Dashboard,
});

const CAP_META: Record<CapacityLevel, { label: string; bar: string; text: string }> = {
  light: { label: "Light", bar: "bg-emerald-500", text: "text-emerald-600" },
  balanced: { label: "Balanced", bar: "bg-primary", text: "text-primary" },
  heavy: { label: "Heavy", bar: "bg-amber-500", text: "text-amber-600" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function JobRow({ j, onOpen, showShoot }: { j: Job; onOpen: (j: Job) => void; showShoot?: boolean }) {
  return (
    <li onClick={() => onOpen(j)} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium">
          <RushBadge job={j} />
          <CategoryChip job={j} />
          <span className="truncate">{j.address ?? j.project_name ?? "Untitled"}</span>
          {!j.editor && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Unassigned</span>}
          {j.notes && (
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs whitespace-pre-wrap text-xs">{j.notes.slice(0, 500)}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {departmentLabel(j.department)} · {j.category} · {j.client ?? "—"}
          {showShoot && j.photographer && <> · Shot by {j.photographer}</>}
        </div>
      </div>
      <StatusTile job={j} className="hidden w-[170px] md:flex" />
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{formatDate(showShoot ? j.shoot_date : j.due_date)}</span>
      <div className="flex w-full items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <JobLinks job={j} />
        <NextActionButtons job={j} />
        <EditorSelect job={j} />
      </div>
    </li>
  );
}

function Dashboard() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const today = todayISO();
  const [open, setOpen] = useState<Job | null>(null);
  const [focusEditor, setFocusEditor] = useState<string | null>(null);
  const monthPrefix = today.slice(0, 7);
  const recentDates = recentShootDates(today);
  const isMonday = recentDates.length > 1;

  const copyBriefing = async () => {
    const label = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    try {
      await navigator.clipboard.writeText(buildBriefing(jobs, today, label));
      toast.success("Morning briefing copied", { description: "Paste it into Slack, email or a text." });
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const d = useMemo(() => {
    const active = jobs.filter((j) => !isClosed(j.status));
    const byDue = (a: Job, b: Job) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9");
    const recent = jobs
      .filter((j) => j.shoot_date && recentDates.includes(j.shoot_date) && stageOf(j.status) !== "canceled")
      .sort((a, b) => Number(!!a.editor) - Number(!!b.editor) || (b.shoot_date ?? "").localeCompare(a.shoot_date ?? ""));
    return {
      active,
      recent,
      dueToday: active.filter((j) => timingOf(j, today) === "due_today").sort(byDue),
      qc: active.filter((j) => stageOf(j.status) === "qc").sort(byDue),
      revision: active.filter((j) => stageOf(j.status) === "revision").sort(byDue),
      editing: active.filter((j) => stageOf(j.status) === "editing").length,
      unassigned: recent.filter((j) => !j.editor && !isClosed(j.status)).length,
      delivered: jobs.filter((j) => stageOf(j.status) === "delivered" && (j.due_date ?? j.shoot_date ?? "").startsWith(monthPrefix)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, today, monthPrefix]);

  const editors = useMemo(() => {
    const m = new Map<string, Job[]>();
    d.active.filter((j) => j.editor).forEach((j) => m.set(j.editor!, [...(m.get(j.editor!) ?? []), j]));
    return [...m.entries()]
      .map(([name, list]) => {
        const upcoming = list.filter((j) => j.due_date && j.due_date >= today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
        return { name, list, next: upcoming[0]?.due_date ?? null, level: capacityLevel(list.length) };
      })
      .sort((a, b) => a.list.length - b.list.length);
  }, [d.active, today]);

  const horizon = [
    { key: "today", title: "Due today", icon: CalendarCheck, list: d.dueToday },
    { key: "qc", title: "Awaiting your QC", icon: CheckCheck, list: d.qc },
    { key: "rev", title: "Needs revision", icon: RotateCcw, list: d.revision },
  ];
  const [tab, setTab] = useState("today");
  const current = horizon.find((h) => h.key === tab)!;

  const cards = [
    { label: isMonday ? "Weekend shoots" : "Yesterday's shoots", value: d.recent.length, icon: Camera, to: "/jobs" as const },
    { label: "Due today", value: d.dueToday.length, icon: CalendarCheck, to: "/delivery" as const },
    { label: "In editing", value: d.editing, icon: Film, to: "/editing" as const },
    { label: "Awaiting QC", value: d.qc.length, icon: CheckCheck, to: "/qc" as const },
    { label: "Needs revision", value: d.revision.length, icon: RotateCcw, to: "/revisions" as const },
    { label: "Delivered this month", value: d.delivered, icon: Upload, to: "/delivery" as const },
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

  const dayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const focused = focusEditor ? editors.find((e) => e.name === focusEditor) : null;

  return (
    <div className="space-y-6">
      {/* Morning header status bar */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dayLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting()}, Corey</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CutoffClock />
            <Button variant="outline" size="sm" onClick={copyBriefing}><ClipboardCopy className="h-4 w-4" /> Copy morning briefing</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{d.recent.length} {isMonday ? "weekend" : "yesterday"} shoots</span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium">{d.dueToday.length} due today</span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium">{d.qc.length} awaiting your QC</span>
          <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 font-medium", d.unassigned ? "bg-amber-100 text-amber-700" : "bg-muted")}>
            <UserX className="h-3 w-3" /> {d.unassigned} unassigned
          </span>
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Active pipeline</span><span>{d.active.length} jobs</span>
          </div>
          <PipelineBattery jobs={d.active} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">{c.label}<c.icon className="h-4 w-4" /></div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          {/* Yesterday's shoots */}
          <section className="rounded-lg border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{isMonday ? "Weekend shoots (Fri–Sun)" : "Yesterday's shoots"}</h2>
              </div>
              <span className="text-xs text-muted-foreground">{recentDates.map((x) => formatDate(x)).join(", ")}</span>
            </div>
            {d.recent.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No shoots on {isMonday ? "Fri–Sun" : "yesterday"}.</p>
            ) : (
              <ul className="max-h-[560px] divide-y overflow-y-auto">
                {d.recent.map((j) => <JobRow key={j.id} j={j} onOpen={setOpen} showShoot />)}
              </ul>
            )}
          </section>

          {/* Action horizon */}
          <section className="rounded-lg border bg-card shadow-card">
            <div className="flex flex-wrap gap-1 border-b px-2 py-2">
              {horizon.map((h) => (
                <button key={h.key} onClick={() => setTab(h.key)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", tab === h.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                  <h.icon className="h-3.5 w-3.5" /> {h.title} <span className="tabular-nums">· {h.list.length}</span>
                </button>
              ))}
            </div>
            {current.list.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing here right now.</p>
            ) : (
              <ul className="max-h-[480px] divide-y overflow-y-auto">
                {current.list.slice(0, 60).map((j) => <JobRow key={j.id} j={j} onOpen={setOpen} />)}
              </ul>
            )}
          </section>
        </div>

        {/* Editor capacity */}
        <section className="h-fit rounded-lg border bg-card shadow-card xl:col-span-2">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Editor capacity</h2>
              <p className="text-xs text-muted-foreground">Lightest load first — click to see their jobs</p>
            </div>
            <Link to="/workload" className="text-xs text-primary hover:underline">Workload</Link>
          </div>
          <ul className="divide-y">
            {editors.map((e) => {
              const meta = CAP_META[e.level];
              return (
                <li key={e.name}>
                  <button onClick={() => setFocusEditor(focusEditor === e.name ? null : e.name)} className={cn("w-full px-4 py-3 text-left hover:bg-muted/50", focusEditor === e.name && "bg-muted/60")}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{e.name}</span>
                      <span className={cn("text-xs font-medium", meta.text)}>{meta.label}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{e.list.length} active</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={cn("h-2 flex-1 rounded-full", i < e.list.length ? meta.bar : "bg-muted")} />
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Next due {e.next ? formatDate(e.next) : "—"}
                    </div>
                  </button>
                  {focused?.name === e.name && (
                    <ul className="divide-y border-t bg-muted/30">
                      {e.list.map((j) => (
                        <li key={j.id} onClick={() => setOpen(j)} className="flex cursor-pointer items-center gap-2 px-6 py-2 text-xs hover:bg-muted">
                          <span className="min-w-0 flex-1 truncate">{j.address ?? j.project_name}</span>
                          <StatusBadge status={j.status} className="max-w-[130px]" />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <JobDialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} job={open} />
    </div>
  );
}

export { TimingBadge };
