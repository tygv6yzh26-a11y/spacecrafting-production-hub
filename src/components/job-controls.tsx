import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Film, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { editorsQuery, useUpdateJob, type Job } from "@/lib/jobs";
import { isRush, nextActions } from "@/lib/workflow";
import { cn } from "@/lib/utils";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function firstUrl(text: string | null | undefined) {
  return text?.match(/https?:\/\/\S+/)?.[0] ?? null;
}

export function EditorSelect({ job, className }: { job: Job; className?: string }) {
  const { data: editors = [] } = useQuery(editorsQuery);
  const update = useUpdateJob();
  const names = editors.filter((e) => e.active).map((e) => e.name);
  const list = job.editor && !names.includes(job.editor) ? [...names, job.editor] : names;
  return (
    <div onClick={stop} onKeyDown={stop}>
      <Select value={job.editor ?? "__none"} onValueChange={(v) => update.mutate({ id: job.id, patch: { editor: v === "__none" ? null : v } })}>
        <SelectTrigger aria-label="Reassign editor" className={cn("h-7 w-28 text-xs", !job.editor && "border-warning text-foreground", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Unassigned</SelectItem>
          {list.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NextActionButtons({ job }: { job: Job }) {
  const update = useUpdateJob();
  return (
    <div className="flex gap-1" onClick={stop}>
      {nextActions(job.status, job.department).map((a) => (
        <Button key={a.status} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => update.mutate({ id: job.id, patch: { status: a.status } })}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

export function JobLinks({ job }: { job: Job }) {
  const links = [
    { href: job.calendar_url, label: "Shoot calendar", Icon: CalendarDays },
    { href: job.address_url, label: "Tour / listing", Icon: MapPin },
    { href: firstUrl(job.deliverable_links), label: "Deliverable", Icon: Film },
  ].filter((l) => l.href);
  if (!links.length) return null;
  return (
    <div className="flex items-center gap-0.5" onClick={stop}>
      {links.map(({ href, label, Icon }) => (
        <a key={label} href={href!} target="_blank" rel="noreferrer" title={label} aria-label={label} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary">
          <Icon className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

export function RushBadge({ job }: { job: Job }) {
  if (!isRush(job)) return null;
  return <span className="rounded bg-warning px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">Rush</span>;
}
