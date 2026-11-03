import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "producer" | "editor";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (error) throw error;
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      name: (u.user.user_metadata?.full_name as string) ?? u.user.email ?? "",
      roles: roles.map((r) => r.role as Role),
    };
  },
});

export type Me = NonNullable<Awaited<ReturnType<typeof meQuery.queryFn>>>;
export const canManage = (me: Me | null | undefined) => !!me?.roles.some((r) => r === "admin" || r === "producer");
export const isAdmin = (me: Me | null | undefined) => !!me?.roles.includes("admin");
