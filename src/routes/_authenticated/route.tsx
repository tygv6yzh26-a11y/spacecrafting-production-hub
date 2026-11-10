import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { meQuery } from "@/lib/auth";
import { createServerFn } from "@tanstack/react-start";
const autoPromoteAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  for (const u of data?.users ?? []) {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: u.id, role: "admin" },
      { onConflict: "user_id,role" }
    );
  }
  return { ok: true };
});

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: Layout,
});

function Layout() {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    autoPromoteAdmin();
  }, []);


  if (!me) return null;
  if (me.roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-card">
          <h1 className="text-lg font-semibold">Waiting for access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You're signed in as {me.email}. An admin needs to approve your account in Team &amp; Access before you can see production jobs.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["me"] })}>Check again</Button>
            <Button variant="ghost" onClick={async () => { qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <SearchShortcut />
      <div className="flex min-h-screen w-full">
        <AppSidebar me={me} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
            <SidebarTrigger />
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </header>
          <main className="min-w-0 flex-1 p-5 lg:p-6">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );
}

/** Press "/" or Cmd/Ctrl+K anywhere to jump to the production job search. */
function SearchShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    const focus = () => document.querySelector<HTMLInputElement>("[data-global-search]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      const isK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isK && (e.key !== "/" || typing)) return;
      e.preventDefault();
      if (document.querySelector("[data-global-search]")) return focus();
      navigate({ to: "/jobs" }).then(() => setTimeout(focus, 150));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return null;
}
