import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS, defaultDeliveryText, parseDeliveryDate, statusOptions } from "@/lib/workflow";
import { editorsQuery, useCreateJob, useUpdateJob, type Job } from "@/lib/jobs";

type Form = {
  department: string;
  shoot_date: string;
  order_number: string;
  category: string;
  photographer: string;
  client: string;
  address: string;
  status: string;
  editor: string;
  delivery_text: string;
  due_date: string;
  deliverable_links: string;
  project_name: string;
  notes: string;
};

const empty: Form = {
  department: "VE",
  shoot_date: "",
  order_number: "",
  category: "",
  photographer: "",
  client: "",
  address: "",
  status: "Waiting on photos/footage to be uploaded",
  editor: "",
  delivery_text: "",
  due_date: "",
  deliverable_links: "",
  project_name: "",
  notes: "",
};

function fromJob(j: Job): Form {
  return {
    department: j.department,
    shoot_date: j.shoot_date ?? "",
    order_number: j.order_number ?? "",
    category: j.category ?? "",
    photographer: j.photographer ?? "",
    client: j.client ?? "",
    address: j.address ?? "",
    status: j.status,
    editor: j.editor ?? "",
    delivery_text: j.delivery_text ?? "",
    due_date: j.due_date ?? "",
    deliverable_links: j.deliverable_links ?? "",
    project_name: j.project_name ?? "",
    notes: j.notes ?? "",
  };
}

export function JobDialog({ open, onOpenChange, job }: { open: boolean; onOpenChange: (o: boolean) => void; job?: Job | null }) {
  const [f, setF] = useState<Form>(empty);
  const [deliveryTouched, setDeliveryTouched] = useState(false);
  const { data: editors = [] } = useQuery(editorsQuery);
  const create = useCreateJob();
  const update = useUpdateJob();

  useEffect(() => {
    if (open) {
      setF(job ? fromJob(job) : empty);
      setDeliveryTouched(!!job);
    }
  }, [open, job]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  function onShootChange(v: string) {
    setF((p) => {
      const next = { ...p, shoot_date: v };
      if (!deliveryTouched && v && p.department !== "Ongoing") {
        next.delivery_text = defaultDeliveryText(v);
        next.due_date = parseDeliveryDate(next.delivery_text) ?? "";
      }
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = (s: string) => (s.trim() ? s.trim() : null);
    const payload = {
      department: f.department,
      shoot_date: n(f.shoot_date),
      order_number: n(f.order_number),
      category: n(f.category),
      photographer: n(f.photographer),
      client: n(f.client),
      address: n(f.address),
      status: f.status,
      editor: n(f.editor),
      delivery_text: n(f.delivery_text),
      due_date: n(f.due_date) ?? parseDeliveryDate(f.delivery_text, n(f.shoot_date)),
      deliverable_links: n(f.deliverable_links),
      project_name: n(f.project_name),
      notes: n(f.notes),
    };
    if (job) await update.mutateAsync({ id: job.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  }

  const statuses = statusOptions(f.department);
  const editorNames = editors.filter((e) => e.active).map((e) => e.name);
  if (f.editor && !editorNames.includes(f.editor)) editorNames.push(f.editor);
  const statusList = f.status && !statuses.includes(f.status) ? [...statuses, f.status] : statuses;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit job" : "New job"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="Sheet">
            <Select value={f.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.department === "Ongoing" ? "Start date" : "Shoot date"}>
            <Input type="date" value={f.shoot_date} onChange={(e) => onShootChange(e.target.value)} />
          </Field>
          <Field label="Order #">
            <Input value={f.order_number} onChange={(e) => set("order_number", e.target.value)} placeholder="e.g. 162811 or Custom" />
          </Field>
          <Field label="Category">
            <Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="AV, A+A (C), SVV (Dynamic)…" list="categories" />
          </Field>
          {f.department === "Ongoing" && (
            <Field label="Project name" full>
              <Input value={f.project_name} onChange={(e) => set("project_name", e.target.value)} />
            </Field>
          )}
          <Field label="Photographer(s)">
            <Input value={f.photographer} onChange={(e) => set("photographer", e.target.value)} />
          </Field>
          <Field label="Realtor / Company / Client">
            <Input value={f.client} onChange={(e) => set("client", e.target.value)} required />
          </Field>
          <Field label="Address" full>
            <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Editor / Esoft">
            <Select value={f.editor || "__none"} onValueChange={(v) => set("editor", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {editorNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Delivery date range">
            <Input
              value={f.delivery_text}
              onChange={(e) => {
                setDeliveryTouched(true);
                const t = e.target.value;
                setF((p) => ({ ...p, delivery_text: t, due_date: parseDeliveryDate(t) ?? p.due_date }));
              }}
              placeholder="Deliver by MM/DD/YYYY no later than 5PM"
            />
          </Field>
          <Field label="Deadline">
            <Input type="date" value={f.due_date} onChange={(e) => { setDeliveryTouched(true); set("due_date", e.target.value); }} />
          </Field>
          <Field label="Deliverable links / notes" full>
            <Textarea rows={2} value={f.deliverable_links} onChange={(e) => set("deliverable_links", e.target.value)} />
          </Field>
          {f.department === "Ongoing" && (
            <Field label="Notes" full>
              <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          )}
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving…" : job ? "Save changes" : "Add job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
