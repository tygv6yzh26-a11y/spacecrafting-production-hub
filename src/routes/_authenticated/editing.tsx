import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/components/jobs-view";
import { jobsQuery } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/editing")({
  head: () => ({ meta: [{ title: "Editing — Spacecrafting Video" }, { name: "description", content: "Jobs with footage in hand: ready to edit and in editing." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: () => (
    <JobsView
      title="Editing"
      description="Footage received and ready to edit, in-house editing, and E-soft editing."
      stages={["ready", "editing"]}
      quickActions={[{ label: "Start editing", status: "Editing" }, { label: "Send to QC", status: "Needs QC" }]}
    />
  ),
});
