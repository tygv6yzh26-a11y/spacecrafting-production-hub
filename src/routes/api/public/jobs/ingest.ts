import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { defaultDeliveryText, defaultDueDate } from "@/lib/workflow";

// Receives the nightly 6PM calendar events from the Google Apps Script relay.
const Event = z
  .object({
    summary: z.string().max(500).nullish(),
    htmlLink: z.string().max(2000).nullish(),
    location: z.string().max(500).nullish(),
    eventDetail: z.string().max(5000).nullish(),
    startDate: z.object({ date: z.string().max(40).nullish(), dateTime: z.string().max(40).nullish() }).partial().nullish(),
    order: z.object({ orderNumber: z.union([z.string(), z.number()]).nullish() }).partial().passthrough().nullish(),
    tour: z
      .object({
        tourId: z.union([z.string(), z.number()]).nullish(),
        customer: z.object({ fullName: z.string().max(300).nullish() }).partial().passthrough().nullish(),
        address: z.object({ singleLine: z.string().max(500).nullish() }).partial().passthrough().nullish(),
      })
      .partial()
      .passthrough()
      .nullish(),
    users: z.array(z.any()).max(50).nullish(),
  })
  .passthrough();

const Body = z.object({
  department: z.enum(["VE", "SVV", "AI", "Social"]),
  events: z.array(Event).max(500),
});

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function category(summary: string, dept: string) {
  const s = summary.toLowerCase();
  if (s.includes("vacant")) return s.includes("plus") ? "Vacant AI Plus" : "Vacant AI";
  if (s.includes("social")) return "Social Cut";
  return dept;
}

function photographers(users: unknown[] | null | undefined) {
  if (!users?.length) return null;
  const names = users
    .map((u) => (u && typeof u === "object" ? ((u as Record<string, unknown>).fullName ?? (u as Record<string, unknown>).name) : null))
    .filter((n): n is string => typeof n === "string");
  return names.length ? names.join(", ") : `${users.length} Photographer(s)`;
}

export const Route = createFileRoute("/api/public/jobs/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["INGEST_API_KEY"];
        const given = request.headers.get("x-api-key") ?? "";
        if (!expected) return new Response("Server not configured", { status: 500 });
        const { timingSafeEqual } = await import("node:crypto");
        const a = Buffer.from(given);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Unauthorized", { status: 401 });

        let parsed;
        try {
          parsed = Body.safeParse(await request.json());
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
        const { department, events } = parsed.data;

        const rows = events.flatMap((e) => {
          const shoot = (e.startDate?.date ?? e.startDate?.dateTime ?? "").slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(shoot)) return [];
          const order = e.order?.orderNumber != null ? String(e.order.orderNumber).replace(/\.0$/, "") : null;
          const address = e.tour?.address?.singleLine ?? e.location ?? null;
          const client = e.tour?.customer?.fullName ?? null;
          const cat = category(e.summary ?? "", department);
          const sheetMonth = `${MONTHS[Number(shoot.slice(5, 7)) - 1]} ${shoot.slice(0, 4)}`;
          const key = order && /^\d{4,}$/.test(order)
            ? `${department}:order:${order}:${norm(cat)}`
            : `${department}:event:${norm(e.htmlLink ?? "") || `${shoot}:${norm(address)}`}`;
          return [{
            department,
            sheet_month: sheetMonth,
            shoot_date: shoot,
            calendar_url: e.htmlLink ?? null,
            order_number: order,
            category: cat,
            photographer: photographers(e.users),
            client,
            address,
            address_url: e.tour?.tourId ? `https://dash-next.spacecrafting.com/tour/videos/${e.tour.tourId}` : null,
            status: cat.startsWith("Vacant AI") ? "Waiting for VS" : "Waiting on photos/footage to be uploaded",
            delivery_text: defaultDeliveryText(shoot),
            due_date: defaultDueDate(shoot),
            notes: e.eventDetail ?? null,
            source_sheet: `Calendar feed (${department})`,
            import_key: key,
          }];
        });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Skip orders that already exist (e.g. imported from the spreadsheet) so nothing duplicates.
        const orders = rows.map((r) => r.order_number).filter(Boolean) as string[];
        const existing = new Set<string>();
        if (orders.length) {
          const { data } = await supabaseAdmin.from("jobs").select("order_number").eq("department", department).in("order_number", orders);
          data?.forEach((d) => d.order_number && existing.add(d.order_number));
        }
        const fresh = rows.filter((r) => !r.order_number || !existing.has(r.order_number));
        let added = 0;
        if (fresh.length) {
          const { data, error } = await supabaseAdmin.from("jobs").upsert(fresh, { onConflict: "import_key", ignoreDuplicates: true }).select("id");
          if (error) return Response.json({ error: "Database error" }, { status: 500 });
          added = data?.length ?? 0;
        }
        return Response.json({ received: events.length, added, skipped: events.length - added });
      },
    },
  },
});
