import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];

async function fetchAllJobs(): Promise<Job[]> {
  const pageSize = 1000;
  const all: Job[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

export const jobsQuery = queryOptions({ queryKey: ["jobs"], queryFn: fetchAllJobs, staleTime: 30_000 });

export const editorsQuery = queryOptions({
  queryKey: ["editors"],
  queryFn: async () => {
    const { data, error } = await supabase.from("editors").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: async () => {
    const { data, error } = await supabase.from("clients").select("name").order("name");
    if (error) throw error;
    return data.map((c) => c.name);
  },
});

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: JobUpdate }) => {
      const { data, error } = await supabase.from("jobs").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const prev = qc.getQueryData<Job[]>(["jobs"]);
      qc.setQueryData<Job[]>(["jobs"], (old) => old?.map((j) => (j.id === id ? { ...j, ...patch } as Job : j)));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs"], ctx.prev);
      toast.error("Couldn't save change", { description: (err as Error).message });
    },
    onSuccess: (row) => {
      qc.setQueryData<Job[]>(["jobs"], (old) => old?.map((j) => (j.id === row.id ? row : j)));
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: JobInsert) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("jobs").insert({ ...job, created_by: u.user?.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job added");
    },
    onError: (err) => toast.error("Couldn't add job", { description: (err as Error).message }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job deleted");
    },
    onError: (err) => toast.error("Couldn't delete job", { description: (err as Error).message }),
  });
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
