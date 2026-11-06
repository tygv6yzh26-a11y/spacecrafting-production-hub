import { Checkbox } from "@/components/ui/checkbox";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseWorkbook, type ParsedWorkbook } from "@/lib/import-sheet";
import { jobsQuery, formatDate, type JobUpdate } from "@/lib/jobs";
import { departmentLabel } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import Spreadsheet — Spacecrafting Video" }, { name: "description", content: "Import jobs from the master spreadsheet." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: ImportPage,
});

type Summary = {
  updated?: number; inserted: number; skipped: number; clients: number; failed: number };

function ImportPage() {
  const { data: existing } = useSuspenseQuery(jobsQuery);
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const existingKeys = useMemo(() => new Set(existing.map((j) => j.import_key).filter(Boolean)), [existing]);
  const fresh = useMemo(() => parsed?.jobs.filter((j) => !existingKeys.has(j.import_key)) ?? [], [parsed, existingKeys]);
  const dupes = (parsed?.jobs.length ?? 0) - fresh.length;
  const [updateExisting, setUpdateExisting] = useState(true);
  const existingByKey = useMemo(() => new Map(existing.map((j) => [j.import_key, j])), [existing]);
  // Existing jobs whose sheet values differ from what's in the app.
  const changed = useMemo(() => {
    if (!parsed) return [];
    const fields = ["status", "editor", "delivery_text", "deliverable_links", "notes", "staff_assigned", "photographer", "category", "address_url", "calendar_url"] as const;
    return parsed.jobs.flatMap((j) => {
      const cur = existingByKey.get(j.import_key);
      if (!cur) return [];
      const patch: JobUpdate = {};
      for (const f of fields) if ((j[f] ?? null) !== (cur[f] ?? null) && j[f] != null) (patch as Record<string, string | null>)[f] = j[f];
      return Object.keys(patch).length ? [{ id: cur.id, patch }] : [];
    });
  }, [parsed, existingByKey]);

  async function onFile(file: File) {
    setParsing(true);
    setSummary(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      setParsed(parseWorkbook(buf));
    } catch (e) {
      toast.error("Couldn't read that file", { description: (e as Error).message });
      setParsed(null);
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!parsed) return;
    setProgress(0);
    const res: Summary = { inserted: 0, skipped: dupes, clients: 0, failed: 0 };
    try {
      if (parsed.clients.length) {
        const { data, error } = await supabase.from("clients").upsert(parsed.clients, { onConflict: "name", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        res.clients = data.length;
      }
      const { data: u } = await supabase.auth.getUser();
      const batch = 200;
      for (let i = 0; i < fresh.length; i += batch) {
        const chunk = fresh.slice(i, i + batch).map((j) => ({ ...j, created_by: u.user?.id ?? null }));
        const { data, error } = await supabase.from("jobs").upsert(chunk, { onConflict: "import_key", ignoreDuplicates: true }).select("id");
        if (error) {
          res.failed += chunk.length;
          toast.error("A batch failed to import", { description: error.message });
        } else {
          res.inserted += data.length;
          res.skipped += chunk.length - data.length;
        }
        setProgress(Math.round(((i + chunk.length) / Math.max(1, fresh.length)) * 100));
      }
      if (updateExisting) {
        res.updated = 0;
        for (const c of changed) {
          const { error } = await supabase.from("jobs").update(c.patch).eq("id", c.id);
          if (error) res.failed += 1; else res.updated += 1;
        }
      }
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      setSummary(res);
      toast.success(`Imported ${res.inserted} jobs`);
    } catch (e) {
      toast.error("Import failed", { description: (e as Error).message });
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import Spreadsheet</h1>
        <p className="text-sm text-muted-foreground">
          Upload the master .xlsx. Jul–Nov 2026 VE / SVV / AI tabs, Social Cut Projects, Ongoing Projects, Client Info and Agent + Staff Info are read. Re-uploading never creates duplicates; turn on "Update existing jobs" to refresh statuses, editors and links from the sheet.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card p-10 text-center shadow-card hover:border-primary/50">
        {parsing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <FileSpreadsheet className="h-6 w-6 text-primary" />}
        <span className="text-sm font-medium">{fileName || "Choose spreadsheet (.xlsx)"}</span>
        <span className="text-xs text-muted-foreground">Nothing is saved until you confirm the import.</span>
        <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {summary && (
        <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-card p-4 shadow-card">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
          <div className="text-sm">
            <div className="font-semibold">Import complete</div>
            <div className="text-muted-foreground">
              {summary.inserted} jobs added · {summary.updated ? `${summary.updated} jobs updated · ` : ""}{summary.skipped} duplicates skipped · {summary.clients} new clients{summary.failed ? ` · ${summary.failed} failed` : ""}
            </div>
            <Link to="/dashboard" className="mt-1 inline-block text-primary hover:underline">Go to dashboard →</Link>
          </div>
        </div>
      )}

      {parsed && !summary && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Jobs found" value={parsed.jobs.length} />
            <Stat label="New jobs to import" value={fresh.length} highlight />
            <Stat label={updateExisting ? "Existing jobs with changes" : "Already in app (skipped)"} value={updateExisting ? changed.length : dupes} />
            <Stat label="Clients / top agents" value={parsed.clients.length} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-lg border bg-card shadow-card">
              <div className="border-b px-4 py-2.5 text-sm font-semibold">Column mapping</div>
              <ul className="divide-y text-xs">
                {[
                  ["Shoot date / Start Date", "Shoot date (+ calendar link)"],
                  ["Order #", "Order #"],
                  ["Category", "Category"],
                  ["Photographer(s) / Videographer(s)", "Photographer"],
                  ["Realtor/Company/Client", "Client"],
                  ["Address", "Address (+ tour link)"],
                  ["Status", "Status"],
                  ["Editor / Esoft", "Editor"],
                  ["Delivery Date Range", "Delivery text → Deadline"],
                  ["Deliverable links / Notes/links", "Deliverable links"],
                  ["Project Name, Staff, Notes", "Ongoing project fields"],
                ].map(([a, b]) => (
                  <li key={a} className="flex justify-between gap-2 px-4 py-1.5"><span className="text-muted-foreground">{a}</span><span className="text-right font-medium">{b}</span></li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-card shadow-card lg:col-span-2">
              <div className="border-b px-4 py-2.5 text-sm font-semibold">Tabs read</div>
              <div className="flex flex-wrap gap-2 p-4 text-xs">
                {parsed.sheets.map((s) => <span key={s.name} className="rounded border px-2 py-0.5">{s.name} · <b>{s.rows}</b></span>)}
              </div>
              <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                Ignored: {parsed.skippedSheets.join(", ") || "none"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-sm font-semibold">Preview of new jobs {fresh.length > 50 && <span className="font-normal text-muted-foreground">(first 50 of {fresh.length})</span>}</span>
              <label className="ml-auto mr-3 flex items-center gap-1.5 text-xs">
                <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(!!v)} /> Update existing jobs from sheet (status, editor, delivery, links, notes)
              </label>
              <Button size="sm" disabled={fresh.length === 0 && parsed.clients.length === 0 && (!updateExisting || changed.length === 0) || progress !== null} onClick={() => setConfirm(true)}>
                {progress !== null ? `Importing… ${progress}%` : `Import ${fresh.length} new${updateExisting ? ` · update ${changed.length}` : ""}`}
              </Button>
            </div>
            {progress !== null && <Progress value={progress} className="h-1 rounded-none" />}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr className="text-left">
                    {["Tab", "Shoot", "Order #", "Category", "Client", "Address", "Status", "Editor", "Deadline"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {fresh.slice(0, 50).map((j) => (
                    <tr key={j.import_key} className="border-t">
                      <td className="px-3 py-1.5 whitespace-nowrap">{j.source_sheet}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{j.shoot_date ? formatDate(j.shoot_date) : j.shoot_date_text ?? "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{j.order_number}</td>
                      <td className="px-3 py-1.5">{j.category}</td>
                      <td className="max-w-[160px] truncate px-3 py-1.5">{j.client}</td>
                      <td className="max-w-[220px] truncate px-3 py-1.5">{j.address ?? j.project_name}</td>
                      <td className="px-3 py-1.5"><StatusBadge status={j.status} className="max-w-[180px]" /></td>
                      <td className="px-3 py-1.5">{j.editor}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(j.due_date)}</td>
                    </tr>
                  ))}
                  {fresh.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Every job in this file is already in the app.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import spreadsheet?</AlertDialogTitle>
            <AlertDialogDescription>
              {fresh.length} new jobs across {new Set(fresh.map((j) => departmentLabel(j.department))).size} sheets will be added. {updateExisting ? `${changed.length} existing jobs will be updated from the sheet.` : `${dupes} jobs already in the app will be left untouched.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runImport}>Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-card ${highlight ? "border-primary/40" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
