import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/components/jobs-view";
import { jobsQuery } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/qc")({
  head: () => ({ meta: [{ title: "Quality Control — Spacecrafting Video" }, { name: "description", content: "Edits waiting on QC." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: () => (
    <JobsView
      title="Quality Control"
      description="Edits marked Needs QC. Pass them to QC Complete or send back for revision."
      stages={["qc"]}
      showNew={false}
      quickActions={[{ label: "QC Complete", status: "QC Complete" }, { label: "Needs revision", status: "Revision requested" }]}
    />
  ),
});
