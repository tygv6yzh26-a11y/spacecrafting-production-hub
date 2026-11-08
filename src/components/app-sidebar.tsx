import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Clapperboard, FileUp, Film, LayoutDashboard, ListVideo, LogOut, Moon, RotateCcw, Sun, Send, Users, UsersRound } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canManage, isAdmin, type Me } from "@/lib/auth";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Production Jobs", url: "/jobs", icon: ListVideo },
  { title: "Editing", url: "/editing", icon: Film },
  { title: "Quality Control", url: "/qc", icon: CheckCheck },
  { title: "Revisions", url: "/revisions", icon: RotateCcw },
  { title: "Delivery", url: "/delivery", icon: Send },
  { title: "Editor Workload", url: "/workload", icon: UsersRound },
] as const;

export function AppSidebar({ me }: { me: Me }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const admin = [
    ...(canManage(me) ? [{ title: "Import Spreadsheet", url: "/import", icon: FileUp }] : []),
    ...(isAdmin(me) ? [{ title: "Team & Access", url: "/team", icon: Users }] : []),
  ] as const;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Clapperboard className="h-5 w-5 shrink-0 text-sidebar-primary" />
          <div className="truncate group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold text-sidebar-accent-foreground">Spacecrafting Video</div>
            <div className="text-[11px]">Production Dashboard</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={path === i.url} tooltip={i.title}>
                    <Link to={i.url}><i.icon className="h-4 w-4" /><span>{i.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((i) => (
                  <SidebarMenuItem key={i.url}>
                    <SidebarMenuButton asChild isActive={path === i.url} tooltip={i.title}>
                      <Link to={i.url}><i.icon className="h-4 w-4" /><span>{i.title}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="truncate px-2 text-xs group-data-[collapsible=icon]:hidden">
          <div className="truncate text-sidebar-accent-foreground">{me.name}</div>
          <div className="capitalize">{me.roles.join(", ")}</div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign out"><LogOut className="h-4 w-4" /><span>Sign out</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(localStorage.getItem("theme") === "dark"); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const flip = () => { const n = !dark; setDark(n); localStorage.setItem("theme", n ? "dark" : "light"); };
  return (
    <SidebarMenuButton onClick={flip} tooltip={dark ? "Light mode" : "Dark mode"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span>{dark ? "Light mode" : "Dark mode"}</span>
    </SidebarMenuButton>
  );
}
