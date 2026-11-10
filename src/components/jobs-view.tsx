import { Fragment, useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, LayoutList, Columns3, Rows3, Rows4, Table2, ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, TimingBadge } from "@/components/status-badge";
import { JobDialog } from "@/components/job-dialog";
import { EditorSelect, JobLinks, NotesCell, RushBadge } from "@/components/job-controls";
import { BatchBar, CategoryChip, DeadlineShifter, PipelineBattery, StatusTile } from "@/components/board-widgets";
import { cn } from "@/lib/utils";
import { editorsQuery, formatDate, jobsQuery, todayISO, useDeleteJob, useUpdateJob, type Job } from "@/lib/jobs";
import { meQuery, canManage } from "@/lib/auth";
import { DEPARTMENTS, departmentLabel, stageOf, statusOptions, timingOf, STAGE_META, PRESETS, BOARD_GROUPS, STAGE_META as _SM, recentShootDates, countdownLabel, nextActions, urgencyRank, type Stage, type PresetKey } from "@/lib/workflow";

type SortKey = "due_date" | "shoot_date" | "editor" | "status" | "client" | "category" | "department";
type QuickAction = { label: string; status: string };

const PAGE = 100;

export function JobsView({
  title,
  description,
  stages,
  quickActions = [],
  defaultSort = { key: "due_date", dir: "asc" },
  showNew = true,
  hideClosedByDefault = false,
  cockpit = false,
}: {
  title: string;
  description?: string;
  stages?: Stage[];
  quickActions?: QuickAction[];
  defaultSort?: { key: SortKey; dir: "asc" | "desc" };
  showNew?: boolean;
  hideClosedByDefault?: boolean;
  cockpit?: boolean;
}) {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const { data: editors = [] } = useQuery(editorsQuery);
  const { data: me } = useQuery(meQuery);
  const update = useUpdateJob();
  const del = useDeleteJob();
  const today = todayISO();

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState("all");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");
  const [shootFrom, setShootFrom] = useState("");
  const [shootTo, setShootTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [hideClosed, setHideClosed] = useState(hideClosedByDefault);
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Job | null>(null);
  const [preset, setPreset] = useState<PresetKey>("active");
  const [timingPill, setTimingPill] = useState<"overdue" | "due_today" | null>(null);
  const [urgentFirst, setUrgentFirst] = useState(cockpit);
  const [view, setView] = useState<"groups" | "table" | "board">(cockpit ? "groups" : "table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["delivered", "canceled"]));
  const [quick, setQuick] = useState<"unassigned" | "yesterday" | "myqc" | null>(null);
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [compact, setCompact] = useState(false);

  const presetStages = cockpit ? (PRESETS.find((p) => p.key === preset)?.stages as readonly Stage[] | null) : null;
  const scoped = useMemo(() => {
    const st = stages ?? presetStages;
    return st ? jobs.filter((j) => st.includes(stageOf(j.status))) : jobs;
  }, [jobs, stages, presetStages]);
  const active = useMemo(() => jobs.filter((j) => !["delivered", "canceled"].includes(stageOf(j.status))), [jobs]);
  const counts = useMemo(() => ({
    overdue: active.filter((j) => timingOf(j, today) === "overdue").length,
    due_today: active.filter((j) => timingOf(j, today) === "due_today").length,
    byPreset: Object.fromEntries(PRESETS.map((p) => [p.key, p.stages ? jobs.filter((j) => (p.stages as readonly Stage[]).includes(stageOf(j.status))).length : jobs.length])) as Record<PresetKey, number>,
  }), [jobs, active, today]);
  const categories = useMemo(() => [...new Set(scoped.map((j) => j.category?.trim()).filter(Boolean) as string[])].sort(), [scoped]);
  const months = useMemo(() => [...new Set(scoped.map((j) => j.sheet_month).filter(Boolean) as string[])], [scoped]);
  const editorNames = useMemo(() => {
    const s = new Set(editors.map((e) => e.name));
    scoped.forEach((j) => j.editor && s.add(j.editor));
    return [...s].sort();
  }, [editors, scoped]);
  const statuses = useMemo(() => [...new Set(scoped.map((j) => j.status))].sort(), [scoped]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = scoped.filter((j) => {
      if (needle) {
        const hay = [j.address, j.client, j.photographer, j.order_number, j.project_name, j.category].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (dept !== "all" && j.department !== dept) return false;
      if (category !== "all" && j.category?.trim() !== category) return false;
      if (editor !== "all" && (editor === "__none" ? !!j.editor : j.editor !== editor)) return false;
      if (status !== "all" && j.status !== status) return false;
      if (month !== "all" && j.sheet_month !== month) return false;
      if (shootFrom && (!j.shoot_date || j.shoot_date < shootFrom)) return false;
      if (shootTo && (!j.shoot_date || j.shoot_date > shootTo)) return false;
      if (dueFrom && (!j.due_date || j.due_date < dueFrom)) return false;
      if (dueTo && (!j.due_date || j.due_date > dueTo)) return false;
      if (overdueOnly && timingOf(j, today) !== "overdue") return false;
      if (hideClosed && !(cockpit && preset === "all") && ["delivered", "canceled"].includes(stageOf(j.status))) return false;
      if (timingPill && timingOf(j, today) !== timingPill) return false;
      if (quick === "unassigned" && (j.editor || ["delivered", "canceled"].includes(stageOf(j.status)))) return false;
      if (quick === "yesterday" && !(j.shoot_date && recentShootDates(today).includes(j.shoot_date))) return false;
      if (quick === "myqc" && stageOf(j.status) !== "qc") return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (urgentFirst) {
        const d = urgencyRank(a, today) - urgencyRank(b, today);
        if (d) return d;
      }
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      if (!av && bv) return 1;
      if (av && !bv) return -1;
      return av.localeCompare(bv) * dir;
    });
    return rows;
  }, [scoped, q, dept, category, editor, status, month, shootFrom, shootTo, dueFrom, dueTo, overdueOnly, hideClosed, sort, today, timingPill, urgentFirst, cockpit, preset, quick]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const sections = view === "groups"
    ? BOARD_GROUPS.map((g) => ({ ...g, rows: filtered.filter((j) => g.stages.includes(stageOf(j.status))) })).filter((g) => g.rows.length)
    : [{ key: "all", label: "", stages: [] as Stage[], accent: "", rows: pageRows }];
  const selectedJobs = jobs.filter((j) => selected.has(j.id));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const activeFilters = [dept, category, editor, status, month].filter((v) => v !== "all").length + [shootFrom, shootTo, dueFrom, dueTo].filter(Boolean).length + (overdueOnly ? 1 : 0);

  function resetFilters() {
    setDept("all"); setCategory("all"); setEditor("all"); setStatus("all"); setMonth("all");
    setShootFrom(""); setShootTo(""); setDueFrom(""); setDueTo(""); setOverdueOnly(false); setTimingPill(null); setPage(0);
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}
        {sort.key === k ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );

  const FilterSelect = ({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) => (
    <Select value={value} onValueChange={(v) => { onChange(v); setPage(0); }}>
      <SelectTrigger className={cn("h-8 w-auto min-w-[120px] max-w-[220px] text-xs", value !== "all" && "border-primary text-primary")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {showNew && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> New job
          </Button>
        )}
      </div>

      {cockpit && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Pill label="Overdue" value={counts.overdue} tone="overdue" active={timingPill === "overdue"} onClick={() => { setPreset("active"); setTimingPill(timingPill === "overdue" ? null : "overdue"); setPage(0); }} />
            <Pill label="Due today" value={counts.due_today} tone="warn" active={timingPill === "due_today"} onClick={() => { setPreset("active"); setTimingPill(timingPill === "due_today" ? null : "due_today"); setPage(0); }} />
            {(["footage", "editing", "qc", "revision"] as const).map((k) => (
              <Pill key={k} label={PRESETS.find((p) => p.key === k)!.label} value={counts.byPreset[k]} active={preset === k && !timingPill} onClick={() => { setPreset(preset === k ? "active" : k); setTimingPill(null); setPage(0); }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => { setPreset(p.key); setTimingPill(null); setPage(0); }}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", preset === p.key && !timingPill ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                {p.label} <span className="ml-1 opacity-70">{counts.byPreset[p.key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {cockpit && (
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Active pipeline</span><span>{active.length} jobs</span>
          </div>
          <PipelineBattery jobs={active} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([["unassigned", "Unassigned only"], ["yesterday", "Shoots from yesterday"], ["myqc", "Ready for my QC"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setQuick(quick === k ? null : k); setPage(0); }}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", quick === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} data-global-search placeholder="Search address, client, agent, order #  ( / )" className="h-8 pl-8 text-sm" />
          </div>
          <FilterSelect value={dept} onChange={setDept} placeholder="All sheets" options={DEPARTMENTS.map((d) => ({ value: d.value, label: d.label }))} />
          <FilterSelect value={month} onChange={setMonth} placeholder="All months" options={months.map((m) => ({ value: m, label: m }))} />
          <FilterSelect value={category} onChange={setCategory} placeholder="All categories" options={categories.map((c) => ({ value: c, label: c }))} />
          <FilterSelect value={editor} onChange={setEditor} placeholder="All editors" options={[{ value: "__none", label: "Unassigned" }, ...editorNames.map((e) => ({ value: e, label: e }))]} />
          <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={statuses.map((s) => ({ value: s, label: s }))} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <DateRange label="Shoot" from={shootFrom} to={shootTo} setFrom={setShootFrom} setTo={setShootTo} />
          <DateRange label="Deadline" from={dueFrom} to={dueTo} setFrom={setDueFrom} setTo={setDueTo} />
          <label className="flex items-center gap-1.5">
            <Checkbox checked={overdueOnly} onCheckedChange={(v) => { setOverdueOnly(!!v); setPage(0); }} /> Overdue only
          </label>
          {cockpit && (
            <label className="flex items-center gap-1.5">
              <Checkbox checked={urgentFirst} onCheckedChange={(v) => { setUrgentFirst(!!v); setPage(0); }} /> Pin overdue & due today on top
            </label>
          )}
          {!cockpit && <label className="flex items-center gap-1.5">
            <Checkbox checked={hideClosed} onCheckedChange={(v) => { setHideClosed(!!v); setPage(0); }} /> Hide delivered & canceled
          </label>}
          {activeFilters > 0 && (
            <button onClick={resetFilters} className="inline-flex items-center gap-1 text-primary hover:underline">
              <X className="h-3 w-3" /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
          <span className="ml-auto">{filtered.length.toLocaleString()} jobs</span>
          <div className="flex items-center rounded-md border">
            <button title="Grouped view" aria-label="Grouped view" onClick={() => setView("groups")} className={cn("p-1.5", view === "groups" && "bg-muted text-foreground")}><LayoutList className="h-3.5 w-3.5" /></button>
            <button title="Table view" aria-label="Table view" onClick={() => setView("table")} className={cn("p-1.5", view === "table" && "bg-muted text-foreground")}><Table2 className="h-3.5 w-3.5" /></button>
            <button title="Board view" aria-label="Board view" onClick={() => setView("board")} className={cn("p-1.5", view === "board" && "bg-muted text-foreground")}><Columns3 className="h-3.5 w-3.5" /></button>
          </div>
          {view !== "board" && (
            <button title={compact ? "Comfortable rows" : "Compact rows"} aria-label="Toggle row density" onClick={() => setCompact(!compact)} className="rounded-md border p-1.5 hover:text-foreground">
              {compact ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {view === "board" ? (
          <Board jobs={filtered} today={today} onOpen={(j) => { setEditing(j); setDialogOpen(true); }} />
        ) : (
        <div className="overflow-x-auto">
          <table className={cn("w-full min-w-[1300px] text-sm", compact && "text-xs [&_td]:!py-0.5 [&_td_.text-xs]:leading-tight")}>
            <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="w-8 px-3 py-2"><Checkbox aria-label="Select all" checked={pageRows.length > 0 && pageRows.every((j) => selected.has(j.id))} onCheckedChange={(v) => setSelected(v ? new Set(filtered.slice(0, 500).map((j) => j.id)) : new Set())} /></th>
                <SortHead k="due_date">Deadline</SortHead>
                <SortHead k="shoot_date">Shoot</SortHead>
                <th className="px-3 py-2 text-left font-medium">Order #</th>
                <SortHead k="department">Sheet</SortHead>
                <SortHead k="category">Category</SortHead>
                <SortHead k="client">Client / Address</SortHead>
                <th className="px-3 py-2 text-left font-medium">Photographer</th>
                <SortHead k="status" className="w-[230px]">Status</SortHead>
                <SortHead k="editor" className="w-[130px]">Editor</SortHead>
                <th className="px-3 py-2 text-left font-medium">Delivery / Notes</th>
                <th className="w-[1%] px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-16 text-center text-muted-foreground">No jobs match these filters.</td></tr>
              )}
              {sections.map((g) => (
                <Fragment key={g.key}>
                  {g.key !== "all" && (
                    <tr className="bg-background">
                      <td colSpan={12} className="px-0 pb-1 pt-4">
                        <button onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                          className={cn("flex w-full items-center gap-2 border-l-4 px-3 py-1.5 text-left", g.accent)}>
                          {collapsed.has(g.key) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <span className="text-sm font-bold">{g.label}</span>
                          <span className="text-xs text-muted-foreground">{g.rows.length} job{g.rows.length === 1 ? "" : "s"}</span>
                          <span className="ml-auto w-48"><PipelineBattery jobs={g.rows} className="[&>div:last-child]:hidden" /></span>
                        </button>
                      </td>
                    </tr>
                  )}
              {!collapsed.has(g.key) && g.rows.map((j) => {
                const timing = timingOf(j, today);
                const opts = statusOptions(j.department);
                const statusList = opts.includes(j.status) ? opts : [...opts, j.status];
                const editorList = j.editor && !editorNames.includes(j.editor) ? [...editorNames, j.editor] : editorNames;
                return (
                  <tr key={j.id} className={cn("border-b align-top last:border-0 hover:bg-muted/40", timing === "overdue" && "bg-overdue-soft hover:bg-overdue-soft", selected.has(j.id) && "bg-primary/5")}>
                    <td className={cn("px-3 py-2.5", g.key !== "all" && "border-l-4", g.accent)}><Checkbox aria-label="Select job" checked={selected.has(j.id)} onCheckedChange={() => toggleSel(j.id)} /></td>
                    <td className={cn("whitespace-nowrap px-3 py-2", timing === "overdue" && "border-l-2 border-l-overdue")}>
                      <div className={cn("flex items-center gap-1 font-medium", timing === "overdue" && "text-overdue")}>{formatDeadline(j.due_date)}<DeadlineShifter job={j} /></div>
                      <div className="flex items-center gap-1.5">
                        <TimingBadge timing={timing} />
                        <RushBadge job={j} />
                        {countdownLabel(j, today) && <span className={cn("text-[11px]", timing === "overdue" ? "font-semibold text-overdue" : "text-muted-foreground")}>{countdownLabel(j, today)}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {j.calendar_url ? (
                        <a href={j.calendar_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                          {formatDate(j.shoot_date)} <ExternalLink className="h-3 w-3 opacity-50" />
                        </a>
                      ) : j.shoot_date ? formatDate(j.shoot_date) : <span className="text-muted-foreground">{j.shoot_date_text ?? "—"}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{j.order_number ?? "—"}</td>
                    <td className="px-3 py-2"><span className="rounded border px-1.5 py-0.5 text-xs">{departmentLabel(j.department)}</span></td>
                    <td className="max-w-[160px] px-3 py-2 text-xs"><CategoryChip job={j} /> <span className="text-muted-foreground">{j.category}</span></td>
                    <td className="max-w-[280px] px-3 py-2">
                      <div className="truncate font-medium">{j.project_name ? `${j.project_name} · ` : ""}{j.client}</div>
                      {j.address_url ? (
                        <a href={j.address_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted-foreground hover:text-primary">{j.address}</a>
                      ) : <div className="truncate text-xs text-muted-foreground">{j.address}</div>}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-xs text-muted-foreground">{j.photographer}</td>
                    <td className="px-3 py-1.5">
                      <StatusTile job={j} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={j.editor ?? "__none"} onValueChange={(v) => update.mutate({ id: j.id, patch: { editor: v === "__none" ? null : v } })}>
                        <SelectTrigger aria-label="Editor" className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Unassigned</SelectItem>
                          {editorList.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="max-w-[240px] px-3 py-2 text-xs text-muted-foreground">
                      <div className="truncate" title={j.delivery_text ?? ""}>{j.delivery_text}</div>
                      {j.deliverable_links && (
                        /^https?:\/\//.test(j.deliverable_links) ? (
                          <a href={j.deliverable_links} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">Deliverable link</a>
                        ) : <div className="truncate italic" title={j.deliverable_links}>{j.deliverable_links}</div>
                      )}
                      <NotesCell job={j} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <JobLinks job={j} />
                        {(quickActions.length ? quickActions : cockpit ? nextActions(j.status, j.department) : []).filter((a) => a.status !== j.status).map((a) => (
                          <Button key={a.status} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => update.mutate({ id: j.id, patch: { status: a.status } })}>
                            {a.label}
                          </Button>
                        ))}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Job actions"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(j); setDialogOpen(true); }}><Pencil className="h-4 w-4" /> Edit job</DropdownMenuItem>
                            {canManage(me) && (
                              <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(j)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {view === "table" && pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            Page {page + 1} of {pages}
            <Button size="sm" variant="outline" className="h-7" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>

      <BatchBar jobs={selectedJobs} onClear={() => setSelected(new Set())} />

      <JobDialog open={dialogOpen} onOpenChange={setDialogOpen} job={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.client} — {toDelete?.address}. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && del.mutate(toDelete.id)}>
              Delete job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function formatDeadline(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function Pill({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "overdue" | "warn"; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("rounded-lg border bg-card p-3 text-left shadow-card transition-colors hover:border-primary/50", active && "border-primary ring-1 ring-primary")}>
      <div className={cn("text-2xl font-semibold tabular-nums", tone === "overdue" && value > 0 && "text-overdue", tone === "warn" && value > 0 && "text-warning")}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

function DateRange({ label, from, to, setFrom, setTo }: { label: string; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-[130px] text-xs" aria-label={`${label} from`} />
      <span>–</span>
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-[130px] text-xs" aria-label={`${label} to`} />
    </div>
  );
}

export { STAGE_META };

function Board({ jobs, today, onOpen }: { jobs: Job[]; today: string; onOpen: (j: Job) => void }) {
  const cols = (Object.keys(STAGE_META) as Stage[]).filter((s) => s !== "canceled");
  const grouped = cols.map((s) => ({ s, list: jobs.filter((j) => stageOf(j.status) === s) })).filter((c) => c.list.length || c.s !== "delivered");
  return (
    <div className="flex gap-3 overflow-x-auto p-3">
      {grouped.map(({ s, list }) => (
        <div key={s} className="flex w-64 shrink-0 flex-col rounded-lg bg-muted/50">
          <div className="flex items-center justify-between px-3 py-2 text-xs font-medium">
            <span className={cn("rounded px-1.5 py-0.5", STAGE_META[s].tone)}>{STAGE_META[s].label}</span>
            <span className="text-muted-foreground">{list.length}</span>
          </div>
          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
            {list.slice(0, 150).map((j) => {
              const t = timingOf(j, today);
              return (
                <div key={j.id} role="button" tabIndex={0} onClick={() => onOpen(j)} onKeyDown={(e) => e.key === "Enter" && onOpen(j)}
                  className={cn("cursor-pointer space-y-1.5 rounded-md border bg-card p-2.5 text-xs shadow-card hover:border-primary/50", t === "overdue" && "border-l-2 border-l-overdue")}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="line-clamp-2 font-medium text-foreground">{j.address ?? j.project_name ?? "—"}</div>
                    <RushBadge job={j} />
                  </div>
                  <div className="truncate text-muted-foreground">{[departmentLabel(j.department), j.category, j.client].filter(Boolean).join(" · ")}</div>
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn(t === "overdue" && "font-medium text-overdue")}>{formatDate(j.due_date)}</span>
                    <TimingBadge timing={t} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <EditorSelect job={j} />
                    <JobLinks job={j} />
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <div className="px-1 py-6 text-center text-muted-foreground">Nothing here</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
