import { useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { editorsQuery, formatDate, jobsQuery, todayISO, useDeleteJob, useUpdateJob, type Job } from "@/lib/jobs";
import { meQuery, canManage } from "@/lib/auth";
import { DEPARTMENTS, departmentLabel, stageOf, statusOptions, timingOf, STAGE_META, type Stage } from "@/lib/workflow";

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
}: {
  title: string;
  description?: string;
  stages?: Stage[];
  quickActions?: QuickAction[];
  defaultSort?: { key: SortKey; dir: "asc" | "desc" };
  showNew?: boolean;
  hideClosedByDefault?: boolean;
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

  const scoped = useMemo(() => (stages ? jobs.filter((j) => stages.includes(stageOf(j.status))) : jobs), [jobs, stages]);
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
      if (hideClosed && ["delivered", "canceled"].includes(stageOf(j.status))) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      if (!av && bv) return 1;
      if (av && !bv) return -1;
      return av.localeCompare(bv) * dir;
    });
    return rows;
  }, [scoped, q, dept, category, editor, status, month, shootFrom, shootTo, dueFrom, dueTo, overdueOnly, hideClosed, sort, today]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const activeFilters = [dept, category, editor, status, month].filter((v) => v !== "all").length + [shootFrom, shootTo, dueFrom, dueTo].filter(Boolean).length + (overdueOnly ? 1 : 0);

  function resetFilters() {
    setDept("all"); setCategory("all"); setEditor("all"); setStatus("all"); setMonth("all");
    setShootFrom(""); setShootTo(""); setDueFrom(""); setDueTo(""); setOverdueOnly(false); setPage(0);
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

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search address, client, agent, order #" className="h-8 pl-8 text-sm" />
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
          <label className="flex items-center gap-1.5">
            <Checkbox checked={hideClosed} onCheckedChange={(v) => { setHideClosed(!!v); setPage(0); }} /> Hide delivered & canceled
          </label>
          {activeFilters > 0 && (
            <button onClick={resetFilters} className="inline-flex items-center gap-1 text-primary hover:underline">
              <X className="h-3 w-3" /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
          <span className="ml-auto">{filtered.length.toLocaleString()} jobs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
              <tr className="border-b">
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
                <tr><td colSpan={11} className="px-3 py-16 text-center text-muted-foreground">No jobs match these filters.</td></tr>
              )}
              {pageRows.map((j) => {
                const timing = timingOf(j, today);
                const opts = statusOptions(j.department);
                const statusList = opts.includes(j.status) ? opts : [...opts, j.status];
                const editorList = j.editor && !editorNames.includes(j.editor) ? [...editorNames, j.editor] : editorNames;
                return (
                  <tr key={j.id} className={cn("border-b align-top last:border-0 hover:bg-muted/40", timing === "overdue" && "bg-overdue-soft hover:bg-overdue-soft")}>
                    <td className={cn("whitespace-nowrap px-3 py-2", timing === "overdue" && "border-l-2 border-l-overdue")}>
                      <div className={cn("font-medium", timing === "overdue" && "text-overdue")}>{formatDate(j.due_date)}</div>
                      <TimingBadge timing={timing} />
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
                    <td className="max-w-[160px] px-3 py-2 text-xs">{j.category}</td>
                    <td className="max-w-[280px] px-3 py-2">
                      <div className="truncate font-medium">{j.project_name ? `${j.project_name} · ` : ""}{j.client}</div>
                      {j.address_url ? (
                        <a href={j.address_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted-foreground hover:text-primary">{j.address}</a>
                      ) : <div className="truncate text-xs text-muted-foreground">{j.address}</div>}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-xs text-muted-foreground">{j.photographer}</td>
                    <td className="px-3 py-1.5">
                      <Select value={j.status} onValueChange={(v) => update.mutate({ id: j.id, patch: { status: v } })}>
                        <SelectTrigger aria-label="Status" className="h-auto w-full border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden">
                          <StatusBadge status={j.status} />
                        </SelectTrigger>
                        <SelectContent>
                          {statusList.map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}
                        </SelectContent>
                      </Select>
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
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        {quickActions.filter((a) => a.status !== j.status).map((a) => (
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
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            Page {page + 1} of {pages}
            <Button size="sm" variant="outline" className="h-7" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>

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
