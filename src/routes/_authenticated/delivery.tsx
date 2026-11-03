import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/components/jobs-view";
import { jobsQuery } from "@/lib/jobs";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({ meta: [{ title: "Delivery — Spacecrafting Video" }, { name: "description", content: "QC-complete and uploaded jobs ready to deliver." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: () => (
    <JobsView
      title="Delivery"
      description="QC Complete and Uploaded jobs waiting on final delivery, plus delivered jobs to invoice."
      stages={["qc_complete", "delivered"]}
      showNew={false}
      hideClosedByDefault
      quickActions={[{ label: "Uploaded", status: "Uploaded" }, { label: "Delivered", status: "Delivered" }, { label: "Invoiced", status: "Delivered / Invoiced" }]}
    />
  ),
});
