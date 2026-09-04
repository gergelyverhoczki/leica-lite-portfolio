import { createFileRoute, redirect } from "@tanstack/react-router";

// Project pages moved to /projects/$slug; keep the old URL working.
export const Route = createFileRoute("/work/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projects/$slug", params: { slug: params.slug }, replace: true });
  },
});
