import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Spacecrafting Video Production" },
      { name: "description", content: "Internal production dashboard for the Spacecrafting Video Department." },
      { property: "og:title", content: "Spacecrafting Video Production" },
      { property: "og:description", content: "Internal production dashboard for the Spacecrafting Video Department." },
    ],
  }),
});
