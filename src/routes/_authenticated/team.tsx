import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, isAdmin, type Role } from "@/lib/auth";
import { editorsQuery } from "@/lib/jobs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const teamQuery = queryOptions({
  queryKey: ["team"],
  queryFn: async () => {
    const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    return profiles.map((p) => ({ ...p, role: (roles.find((r) => r.user_id === p.id)?.role ?? null) as Role | null }));
  },
});

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team & Access — Spacecrafting Video" }, { name: "description", content: "Approve team members and manage roles." }] }),
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(teamQuery), context.queryClient.ensureQueryData(editorsQuery)]);
  },
  component: Team,
});

const ROLE_HELP: Record<string, string> = {
  admin: "Everything, plus approving people",
  producer: "Edit, import and delete jobs",
  editor: "View and update jobs",
  none: "No access",
};

function Team() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: team } = useSuspenseQuery(teamQuery);
  const { data: editors } = useSuspenseQuery(editorsQuery);
  const qc = useQueryClient();
  const [newEditor, setNewEditor] = useState("");

  if (!isAdmin(me)) return <p className="text-sm text-muted-foreground">Only admins can manage team access.</p>;

  async function setRole(userId: string, role: string) {
    if (userId === me!.id && role !== "admin") { toast.error("You can't remove your own admin access."); return; }
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); return; }
    if (role !== "none") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as Role });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Access updated");
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function addEditor(e: React.FormEvent) {
    e.preventDefault();
    if (!newEditor.trim()) return;
    const { error } = await supabase.from("editors").insert({ name: newEditor.trim() });
    if (error) { toast.error(error.message); return; }
    setNewEditor("");
    qc.invalidateQueries({ queryKey: ["editors"] });
  }

  async function toggleEditor(id: string, active: boolean) {
    const { error } = await supabase.from("editors").update({ active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["editors"] });
  }

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-5">
      <section className="rounded-lg border bg-card shadow-card lg:col-span-3">
        <div className="border-b px-4 py-3">
          <h1 className="text-sm font-semibold">Team & Access</h1>
          <p className="text-xs text-muted-foreground">New sign-ups have no access until you give them a role.</p>
        </div>
        <ul className="divide-y">
          {team.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.display_name ?? p.email}</div>
                <div className="truncate text-xs text-muted-foreground">{p.email}</div>
              </div>
              {!p.role && <span className="rounded bg-warning-soft px-2 py-0.5 text-xs">Pending</span>}
              <Select value={p.role ?? "none"} onValueChange={(v) => setRole(p.id, v)}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["admin", "producer", "editor", "none"].map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="capitalize">{r}</span> <span className="text-muted-foreground">— {ROLE_HELP[r]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-card shadow-card lg:col-span-2">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Editor / Esoft list</h2>
          <p className="text-xs text-muted-foreground">Names in the Editor dropdown.</p>
        </div>
        <form onSubmit={addEditor} className="flex gap-2 border-b p-3">
          <Input value={newEditor} onChange={(e) => setNewEditor(e.target.value)} placeholder="Add editor" className="h-8" />
          <Button size="sm" type="submit">Add</Button>
        </form>
        <ul className="divide-y">
          {editors.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className={e.active ? "" : "text-muted-foreground line-through"}>{e.name}</span>
              <Switch checked={e.active} onCheckedChange={(v) => toggleEditor(e.id, v)} aria-label={`${e.name} active`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
