import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/components/jobs-view";
import { jobsQuery } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/revisions")({
  head: () => ({ meta: [{ title: "Revisions — Spacecrafting Video" }, { name: "description", content: "Jobs with a revision requested." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: () => (
    <JobsView
      title="Revisions"
      description="Jobs with Revision requested. Move them back into editing or straight to QC."
      stages={["revision"]}
      showNew={false}
      quickActions={[{ label: "Back to editing", status: "Editing" }, { label: "Send to QC", status: "Needs QC" }]}
    />
  ),
});
