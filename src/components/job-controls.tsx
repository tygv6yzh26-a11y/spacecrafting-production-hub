import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Film, FolderSearch, MapPin, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { editorsQuery, useUpdateJob, type Job } from "@/lib/jobs";
import { isRush, nextActions } from "@/lib/workflow";
import { cn } from "@/lib/utils";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function firstUrl(text: string | null | undefined) {
  return text?.match(/https?:\/\/\S+/)?.[0] ?? null;
}
export function dropboxSearchUrl(query: string | null | undefined): string {
  if (!query) return "https://www.dropbox.com/home";
  // Grabs street address before city/state (e.g. "5720 Oakview Lane")
  const cleaned = query.replace(/,.*$/, "").trim();
  return `https://www.dropbox.com/home?query=${encodeURIComponent(cleaned)}`;
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

/** Convert a review link into something playable inside the app. */
export function embedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (vm && !url.includes("player.vimeo.com")) return `https://player.vimeo.com/video/${vm[1]}${vm[2] ? `?h=${vm[2]}` : ""}`;
  if (url.includes("dropbox.com")) return url.replace(/[?&]dl=0/, "").replace("www.dropbox.com", "dl.dropboxusercontent.com");
  return url;
}

export function PreviewButton({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const url = firstUrl(job.deliverable_links) ?? job.address_url;
  if (!url) return null;
  const src = embedUrl(url);
  const isFile = /\.(mp4|mov|webm)(\?|$)/i.test(src) || src.includes("dl.dropboxusercontent.com");
  return (
    <span onClick={stop}>
      <button type="button" title="Preview video" aria-label="Preview video" onClick={() => setOpen(true)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary">
        <PlayCircle className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle className="truncate pr-6 text-sm">{job.address ?? job.project_name ?? "Preview"}</DialogTitle></DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
            {open && (isFile
              ? <video src={src} controls autoPlay className="h-full w-full" />
              : <iframe src={src} title="Video preview" className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />)}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open in new tab if it doesn't load here</a>
        </DialogContent>
      </Dialog>
    </span>
  );
}

export function JobLinks({ job }: { job: Job }) {
  const searchQuery = job.address || job.client || job.order_number;
  const links = [
    { href: job.calendar_url, label: "Shoot calendar", Icon: CalendarDays },
    { href: job.address_url, label: "Tour / listing", Icon: MapPin },
    { href: dropboxSearchUrl(searchQuery), label: "Search footage in Dropbox", Icon: FolderSearch },
    { href: firstUrl(job.deliverable_links), label: "Deliverable", Icon: Film },
  ].filter((l) => l.href);
  if (!links.length) return null;
  return (
    <div className="flex items-center gap-0.5" onClick={stop}>
      <PreviewButton job={job} />
      {links.map(({ href, label, Icon }) => (
        <a key={label} href={href!} target="_blank" rel="noopener" title={label} aria-label={label} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary">
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

export function NotesCell({ job }: { job: Job }) {
  const update = useUpdateJob();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(job.notes ?? "");
  const save = () => {
    setEditing(false);
    const next = val.trim() || null;
    if (next !== (job.notes ?? null)) update.mutate({ id: job.id, patch: { notes: next } });
  };
  if (editing)
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(job.notes ?? ""); setEditing(false); } }}
        className="mt-1 w-full rounded border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        placeholder="Add a note…"
      />
    );
  return (
    <button type="button" onClick={() => { setVal(job.notes ?? ""); setEditing(true); }} title={job.notes ?? "Add a note"}
      className={cn("mt-1 block w-full truncate rounded px-1 text-left text-xs hover:bg-muted", job.notes ? "text-foreground" : "text-muted-foreground/60")}>
      {job.notes || "+ note"}
    </button>
  );
}
