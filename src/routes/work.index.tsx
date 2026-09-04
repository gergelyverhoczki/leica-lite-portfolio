import { createFileRoute, redirect } from "@tanstack/react-router";

// The project index moved to /projects; keep the old URL working.
export const Route = createFileRoute("/work/")({
  beforeLoad: () => {
    throw redirect({ to: "/projects", replace: true });
  },
});
