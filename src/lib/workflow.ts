// Workflow rules derived from the master spreadsheet's dropdowns and conventions.

export const DEPARTMENTS = [
  { value: "VE", label: "VE" },
  { value: "SVV", label: "SVV" },
  { value: "AI", label: "AI" },
  { value: "Social", label: "Social Cut" },
  { value: "Ongoing", label: "Ongoing" },
] as const;

export function departmentLabel(v: string) {
  return DEPARTMENTS.find((d) => d.value === v)?.label ?? v;
}

// Status dropdown from the monthly tabs (VE / SVV / AI), in spreadsheet order.
export const STATUSES = [
  "Waiting on additional photos/footage to be Shot",
  "Waiting on photos/footage to be uploaded",
  "Corey Processing",
  "Ready to edit",
  "Ready for Parallax",
  "Editing",
  "E-soft Editing AI interiors",
  "E-soft Editing",
  "E-soft Editing AV",
  "Waiting for VS",
  "Waiting on client",
  "Needs QC",
  "QC Complete",
  "Uploaded",
  "Delivered",
  "Delivered / Invoiced",
  "Revision requested",
  "Canceled",
] as const;

// Status dropdown from the Ongoing Projects tab.
export const ONGOING_STATUSES = [
  "Need to Process",
  "Processing",
  "Recording timelapse",
  "Ready to Edit",
  "Editing",
  "Esoft Editing",
  "Needs QC",
  "Uploaded",
  "Delivered",
  "Delivered / Invoiced",
  "Waiting on Client",
  "Waiting on Photographer",
  "Done",
] as const;

export function statusOptions(department: string): readonly string[] {
  return department === "Ongoing" ? ONGOING_STATUSES : STATUSES;
}

export type Stage =
  | "shoot"
  | "ready"
  | "editing"
  | "client"
  | "qc"
  | "qc_complete"
  | "revision"
  | "delivered"
  | "canceled";

export const STAGE_META: Record<Stage, { label: string; tone: string }> = {
  shoot: { label: "Shoot / Footage", tone: "stage-shoot" },
  ready: { label: "Ready to edit", tone: "stage-ready" },
  editing: { label: "Editing", tone: "stage-editing" },
  client: { label: "Waiting on client", tone: "stage-client" },
  qc: { label: "Needs QC", tone: "stage-qc" },
  qc_complete: { label: "QC complete / Uploaded", tone: "stage-qcdone" },
  revision: { label: "Revision requested", tone: "stage-revision" },
  delivered: { label: "Delivered", tone: "stage-delivered" },
  canceled: { label: "Canceled", tone: "stage-canceled" },
};

export function stageOf(status: string | null | undefined): Stage {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "shoot";
  if (s.startsWith("cancel")) return "canceled";
  if (s.startsWith("delivered") || s === "done") return "delivered";
  if (s.startsWith("revision")) return "revision";
  if (s === "needs qc" || s === "qcing") return "qc";
  if (s === "qc complete" || s === "uploaded") return "qc_complete";
  if (s.includes("waiting on client")) return "client";
  if (s.includes("editing")) return "editing";
  if (s.startsWith("ready")) return "ready";
  return "shoot";
}

export const CLOSED_STAGES: Stage[] = ["delivered", "canceled"];
export const isClosed = (status: string | null | undefined) => CLOSED_STAGES.includes(stageOf(status));

/** Map spreadsheet status variants onto the canonical dropdown value. */
export function normalizeStatus(raw: string | null | undefined, department: string): string {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!v) return department === "Ongoing" ? "Need to Process" : "Waiting on photos/footage to be uploaded";
  const lower = v.toLowerCase();
  if (lower === "waiting on additional footage to be shot") return "Waiting on additional photos/footage to be Shot";
  if (lower === "waiting on footage to be uploaded") return "Waiting on photos/footage to be uploaded";
  const opts = [...STATUSES, ...ONGOING_STATUSES];
  return opts.find((o) => o.toLowerCase() === lower) ?? v;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/** Team rule: deliver 3 business days after the shoot (weekends skipped), by 5PM. */
export const DELIVERY_OFFSET_DAYS = 3;

export function addBusinessDays(iso: string, days: number): string {
  let cur = iso;
  let left = days;
  while (left > 0) {
    cur = addDays(cur, 1);
    const [y = 0, m = 1, d = 1] = cur.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return cur;
}

export function defaultDueDate(shootISO: string): string {
  return addBusinessDays(shootISO, DELIVERY_OFFSET_DAYS);
}

export function defaultDeliveryText(shootISO: string): string {
  const due = defaultDueDate(shootISO);
  const [y, m, d] = due.split("-");
  return `Deliver by ${m}/${d}/${y} no later than 5PM`;
}

/** Parse the deadline out of the "Delivery Date Range" text (last date wins for ranges). */
export function parseDeliveryDate(text: string | null | undefined, shootISO?: string | null): string | null {
  const t = text ?? "";
  const matches = [...t.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)];
  if (matches.length) {
    const [, m = "1", d = "1", yRaw = "2026"] = matches[matches.length - 1]!;
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    return toISODate(new Date(y, Number(m) - 1, Number(d)));
  }
  if (shootISO) return defaultDueDate(shootISO);
  return null;
}

export type Timing = "overdue" | "due_today" | "at_risk" | "on_track" | "none";

/** At risk: due within 1 day and editing hasn't finished yet. */
export function timingOf(job: { status: string | null; due_date: string | null }, todayISO: string): Timing {
  if (!job.due_date || isClosed(job.status)) return "none";
  if (job.due_date < todayISO) return "overdue";
  if (job.due_date === todayISO) return "due_today";
  const stage = stageOf(job.status);
  const early = stage === "shoot" || stage === "ready" || stage === "client" || stage === "revision";
  if (early && job.due_date <= addDays(todayISO, 1)) return "at_risk";
  return "on_track";
}

/** Whole days from today until the deadline (negative = overdue). */
export function daysUntil(dueISO: string, todayISO: string): number {
  const [a, b, c] = dueISO.split("-").map(Number);
  const [x, y, z] = todayISO.split("-").map(Number);
  return Math.round((Date.UTC(a!, b! - 1, c!) - Date.UTC(x!, y! - 1, z!)) / 86_400_000);
}

/** Human countdown for a deadline, e.g. "Overdue 2d", "Due today 5PM", "In 3d". */
export function countdownLabel(job: { status: string | null; due_date: string | null }, todayISO: string): string | null {
  if (!job.due_date || isClosed(job.status)) return null;
  const n = daysUntil(job.due_date, todayISO);
  if (n < 0) return `Overdue ${-n}d`;
  if (n === 0) return "Due today 5PM";
  if (n === 1) return "Due tomorrow";
  return `In ${n}d`;
}

/** Urgency rank used to pin jobs: overdue, due today, at risk, then the rest. */
export function urgencyRank(job: { status: string | null; due_date: string | null }, todayISO: string): number {
  const t = timingOf(job, todayISO);
  return t === "overdue" ? 0 : t === "due_today" ? 1 : t === "at_risk" ? 2 : t === "on_track" ? 3 : 4;
}

/** One-click next steps per stage, using existing dropdown statuses. */
export function nextActions(status: string | null, department: string): { label: string; status: string }[] {
  const ongoing = department === "Ongoing";
  switch (stageOf(status)) {
    case "shoot": return [{ label: "Footage in", status: ongoing ? "Ready to Edit" : "Ready to edit" }];
    case "ready": return [{ label: "Start edit", status: "Editing" }];
    case "editing":
    case "revision": return [{ label: "Send to QC", status: "Needs QC" }];
    case "client": return [{ label: "Resume edit", status: "Editing" }];
    case "qc": return [
      { label: "Deliver", status: "Delivered" },
      ...(ongoing ? [] : [{ label: "Revision", status: "Revision requested" }]),
    ];
    case "qc_complete": return [{ label: "Deliver", status: "Delivered" }];
    default: return [];
  }
}

/** Morning preset tabs for the production table. */
export const PRESETS = [
  { key: "active", label: "All active", stages: ["shoot", "ready", "editing", "client", "qc", "qc_complete", "revision"] },
  { key: "footage", label: "Waiting on footage", stages: ["shoot"] },
  { key: "ready", label: "Ready to edit", stages: ["ready"] },
  { key: "editing", label: "In edit", stages: ["editing"] },
  { key: "qc", label: "Needs QC", stages: ["qc", "qc_complete"] },
  { key: "revision", label: "Revisions", stages: ["revision"] },
  { key: "client", label: "Waiting on client", stages: ["client"] },
  { key: "all", label: "All incl. history", stages: null },
] as const satisfies readonly { key: string; label: string; stages: readonly Stage[] | null }[];
export type PresetKey = (typeof PRESETS)[number]["key"];

/** Rush: active job whose deadline is tighter than the standard shoot + 3 day turnaround. */
export function isRush(job: { status: string | null; shoot_date: string | null; due_date: string | null }): boolean {
  if (!job.shoot_date || !job.due_date || isClosed(job.status)) return false;
  return job.due_date < defaultDueDate(job.shoot_date);
}

/** Plain-text morning briefing for pasting into Slack/email. */
export function buildBriefing(
  jobs: { status: string; due_date: string | null; shoot_date: string | null; editor: string | null; address: string | null; project_name: string | null }[],
  todayISO: string,
  dateLabel: string,
): string {
  const active = jobs.filter((j) => !isClosed(j.status));
  const name = (j: (typeof jobs)[number]) => j.address ?? j.project_name ?? "Untitled";
  const line = (j: (typeof jobs)[number], extra: string) => `• ${name(j)} — ${j.editor ?? "Unassigned"} (${extra})`;
  const overdue = active.filter((j) => timingOf(j, todayISO) === "overdue");
  const today = active.filter((j) => timingOf(j, todayISO) === "due_today");
  const unassigned = active.filter((j) => !j.editor);
  const footage = active.filter((j) => stageOf(j.status) === "shoot");
  const out = [`Spacecrafting Video Morning Briefing — ${dateLabel}`, ""];
  const section = (title: string, list: typeof jobs, extra: (j: (typeof jobs)[number]) => string) => {
    out.push(`${title} (${list.length}):`);
    if (list.length === 0) out.push("• None");
    list.forEach((j) => out.push(line(j, extra(j))));
    out.push("");
  };
  void overdue;
  section("DELIVERING TODAY", today, (j) => j.status);
  section("UNASSIGNED", unassigned, (j) => `shot ${j.shoot_date ?? "?"}`);
  section("WAITING ON FOOTAGE", footage, (j) => `shot ${j.shoot_date ?? "?"}`);
  return out.join("\n").trim();
}

/** Shoot dates that count as "yesterday's shoots": the previous day, or Fri–Sun on a Monday. */
export function recentShootDates(todayISO: string): string[] {
  const dow = new Date(`${todayISO}T12:00:00`).getDay();
  if (dow === 1) return [addDays(todayISO, -3), addDays(todayISO, -2), addDays(todayISO, -1)];
  return [addDays(todayISO, -1)];
}

export type CapacityLevel = "light" | "balanced" | "heavy";
/** Editor load: 1–2 active = light, 3–4 = balanced, 5+ = heavy. */
export function capacityLevel(active: number): CapacityLevel {
  if (active >= 5) return "heavy";
  if (active >= 3) return "balanced";
  return "light";
}
