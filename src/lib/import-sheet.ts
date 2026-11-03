import * as XLSX from "xlsx";
import { normalizeStatus, parseDeliveryDate, toISODate } from "./workflow";

export type ImportJob = {
  department: string;
  sheet_month: string | null;
  shoot_date: string | null;
  shoot_date_text: string | null;
  calendar_url: string | null;
  order_number: string | null;
  category: string | null;
  photographer: string | null;
  client: string | null;
  address: string | null;
  address_url: string | null;
  status: string;
  editor: string | null;
  delivery_text: string | null;
  due_date: string | null;
  deliverable_links: string | null;
  project_name: string | null;
  staff_assigned: string | null;
  notes: string | null;
  source_sheet: string;
  source_row: number;
  import_key: string;
};

export type ImportClient = {
  name: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  branding_notes: string | null;
  assets_link: string | null;
  is_top_agent: boolean;
};

export type ParsedWorkbook = {
  jobs: ImportJob[];
  clients: ImportClient[];
  sheets: { name: string; department: string; rows: number }[];
  skippedSheets: string[];
};

// Only the last 5 months plus the shared tabs are in scope.
const MONTHS = ["JUL", "AUG", "SEP", "OCT", "NOV"];
const MONTHLY = /^(VE|SVV|AI) (JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) (\d{4})$/;

const HEADER_MAP: Record<string, keyof ImportJob> = {
  "shoot date": "shoot_date",
  "start date": "shoot_date",
  "order #": "order_number",
  category: "category",
  "photographer(s)": "photographer",
  "videographer(s)": "photographer",
  "realtor/company/client": "client",
  address: "address",
  status: "status",
  "editor / esoft": "editor",
  "delivery date range": "delivery_text",
  "deliverable links for custom projects": "deliverable_links",
  "notes/links": "deliverable_links",
  "project name": "project_name",
  "staff assigned to project": "staff_assigned",
  notes: "notes",
};

function clean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function hyperlink(cell: XLSX.CellObject | undefined): { text: string | null; url: string | null } {
  if (!cell) return { text: null, url: null };
  let url: string | null = cell.l?.Target ?? null;
  const f = cell.f ?? "";
  const m = f.match(/HYPERLINK\(\s*"([^"]+)"\s*,\s*"([^"]*)"/i);
  if (m) {
    url = m[1] ?? null;
    return { text: clean(cell.v) ?? clean(m[2]), url };
  }
  if (cell.t === "d" && cell.v instanceof Date) return { text: toISODate(cell.v), url };
  return { text: clean(cell.w ?? cell.v), url };
}

function parseDateText(text: string | null, cell?: XLSX.CellObject): string | null {
  if (cell && cell.t === "d" && cell.v instanceof Date) return toISODate(cell.v);
  if (cell && cell.t === "n" && !cell.f) {
    const d = XLSX.SSF.parse_date_code(cell.v as number);
    if (d) return toISODate(new Date(d.y, d.m - 1, d.d));
  }
  if (!text) return null;
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = (m[3] ?? "").length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return toISODate(new Date(y, Number(m[1]) - 1, Number(m[2])));
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function buildImportKey(j: Pick<ImportJob, "department" | "order_number" | "sheet_month" | "address" | "client" | "category" | "project_name">) {
  const order = (j.order_number ?? "").replace(/\.0$/, "");
  if (/^\d{4,}$/.test(order)) return `${j.department}:order:${order}:${norm(j.category)}`;
  return `${j.department}:${norm(j.sheet_month)}:${norm(j.address)}:${norm(j.client)}:${norm(j.category)}:${norm(j.project_name)}`;
}

function parseJobSheet(ws: XLSX.WorkSheet, sheetName: string, department: string, sheetMonth: string | null): ImportJob[] {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  let headerRow = -1;
  for (let r = range.s.r; r <= Math.min(range.s.r + 3, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (clean(ws[XLSX.utils.encode_cell({ r, c })]?.v)?.toLowerCase() === "status") headerRow = r;
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) return [];

  const cols: Partial<Record<keyof ImportJob, number>> = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = clean(ws[XLSX.utils.encode_cell({ r: headerRow, c })]?.v)?.toLowerCase();
    const key = h ? HEADER_MAP[h] : undefined;
    if (key && cols[key] === undefined) cols[key] = c;
  }

  const out: ImportJob[] = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const cell = (k: keyof ImportJob) => (cols[k] === undefined ? undefined : ws[XLSX.utils.encode_cell({ r, c: cols[k]! })]);
    const val = (k: keyof ImportJob) => hyperlink(cell(k)).text;

    const shoot = hyperlink(cell("shoot_date"));
    const addr = hyperlink(cell("address"));
    const category = val("category");
    const client = val("client");
    const project = val("project_name");
    if (!category && !addr.text && !client && !project) continue;

    const shootISO = parseDateText(shoot.text, cell("shoot_date")?.f ? undefined : cell("shoot_date"));
    const delivery = val("delivery_text");
    const orderRaw = val("order_number");
    const job: ImportJob = {
      department,
      sheet_month: sheetMonth,
      shoot_date: shootISO,
      shoot_date_text: shootISO ? null : shoot.text,
      calendar_url: shoot.url,
      order_number: orderRaw ? orderRaw.replace(/\.0$/, "") : null,
      category,
      photographer: val("photographer"),
      client,
      address: addr.text,
      address_url: addr.url,
      status: normalizeStatus(val("status"), department),
      editor: val("editor"),
      delivery_text: delivery,
      due_date: department === "Ongoing" ? parseDeliveryDate(delivery) : parseDeliveryDate(delivery, shootISO),
      deliverable_links: val("deliverable_links"),
      project_name: project,
      staff_assigned: val("staff_assigned"),
      notes: val("notes"),
      source_sheet: sheetName,
      source_row: r + 1,
      import_key: "",
    };
    job.import_key = buildImportKey(job);
    out.push(job);
  }
  return out;
}

function parseClients(wb: XLSX.WorkBook): ImportClient[] {
  const map = new Map<string, ImportClient>();
  const info = wb.Sheets["Client Info"];
  if (info) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(info, { defval: null });
    for (const row of rows) {
      const name = clean(row["Client"]);
      if (!name) continue;
      map.set(name.toLowerCase(), {
        name,
        category: clean(row["Category"]),
        email: clean(row["Email Address"]),
        phone: clean(row["Phone Number"]),
        branding_notes: clean(row["Branding Notes"]),
        assets_link: clean(row["Link to Assets"]),
        is_top_agent: false,
      });
    }
  }
  const agents = wb.Sheets["Agent + Staff Info"];
  if (agents) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(agents, { defval: null });
    for (const row of rows) {
      const name = clean(row["Top Agents MN"]);
      if (!name) continue;
      const existing = map.get(name.toLowerCase());
      if (existing) existing.is_top_agent = true;
      else map.set(name.toLowerCase(), { name, category: "Realtor", email: null, phone: null, branding_notes: null, assets_link: null, is_top_agent: true });
    }
  }
  return [...map.values()];
}

export function parseWorkbook(data: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(data, { cellFormula: true, cellDates: true, cellNF: false });
  const jobs: ImportJob[] = [];
  const sheets: ParsedWorkbook["sheets"] = [];
  const skippedSheets: string[] = [];

  for (const name of wb.SheetNames) {
    const trimmed = name.trim();
    const m = trimmed.match(MONTHLY);
    let department: string | null = null;
    let month: string | null = null;
    if (m) {
      if (m[3] !== "2026" || !MONTHS.includes(m[2] ?? "")) {
        skippedSheets.push(name);
        continue;
      }
      department = m[1] ?? "VE";
      month = `${m[2]} ${m[3]}`;
    } else if (trimmed === "Social Cut Projects") department = "Social";
    else if (trimmed === "Ongoing Projects") department = "Ongoing";
    else {
      if (trimmed !== "Client Info" && trimmed !== "Agent + Staff Info") skippedSheets.push(name);
      continue;
    }
    const rows = parseJobSheet(wb.Sheets[name]!, name, department as string, month);
    sheets.push({ name, department: department as string, rows: rows.length });
    jobs.push(...rows);
  }

  // Collapse duplicates inside the workbook itself (same key, keep the last occurrence).
  const unique = new Map<string, ImportJob>();
  for (const j of jobs) unique.set(j.import_key, j);

  return { jobs: [...unique.values()], clients: parseClients(wb), sheets, skippedSheets };
}
