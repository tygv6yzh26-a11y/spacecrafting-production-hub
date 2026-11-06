import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/components/jobs-view";
import { jobsQuery } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({ meta: [{ title: "Production Jobs — Spacecrafting Video" }, { name: "description", content: "Active production pipeline with deadlines." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: () => (
    <JobsView cockpit hideClosedByDefault title="Production Jobs" description="Everything being worked on right now, most urgent deadlines first." defaultSort={{ key: "due_date", dir: "asc" }} />
  ),
});
