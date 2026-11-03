import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/components/jobs-view";
import { jobsQuery } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({ meta: [{ title: "Production Jobs — Spacecrafting Video" }, { name: "description", content: "All video production jobs." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: () => (
    <JobsView title="Production Jobs" description="Every job from the VE, SVV, AI, Social Cut and Ongoing sheets." defaultSort={{ key: "shoot_date", dir: "desc" }} />
  ),
});
