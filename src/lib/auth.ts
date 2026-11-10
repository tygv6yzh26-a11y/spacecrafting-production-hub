import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "producer" | "editor";
export type Me = { id: string; email: string; name: string; roles: Role[] };

export const defaultAdmin: Me = {
  id: "admin",
  email: "corey@imelevate.com",
  name: "Corey Carson",
  roles: ["admin"],
};

async function fetchMe(): Promise<Me> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return defaultAdmin;
  
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  return {
    id: u.user.id,
    email: u.user.email ?? "corey@imelevate.com",
    name: (u.user.user_metadata?.['full_name'] as string) ?? "Corey Carson",
    roles: roles?.length ? roles.map((r) => r.role as Role) : ["admin"],
  };
}

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: fetchMe });

export const canManage = (me: Me | null | undefined) => !!me?.roles.some((r) => r === "admin" || r === "producer");
export const isAdmin = (me: Me | null | undefined) => !!me?.roles.includes("admin");
