import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { listPublishedProjects } from "@/lib/projects.functions";

const projectsQueryOptions = queryOptions({
  queryKey: ["published-projects"],
  queryFn: () => listPublishedProjects(),
});

const DESCRIPTION = "Photographic projects by Gergely Verhoczki — curated series of documentary and street photography.";
const SITE_URL = "https://gergelyverhoczki.com";

export const Route = createFileRoute("/projects/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQueryOptions),
  head: () => ({
    meta: [
      { title: "Projects — Gergely Verhoczki" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Projects — Gergely Verhoczki" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/projects` }],
  }),
  errorComponent: ProjectsError,
  notFoundComponent: ProjectsNotFound,
  component: ProjectsIndex,
});

function ProjectsError() {
  return <ProjectsMessage title="Projects unavailable" detail="The projects could not be loaded." />;
}

function ProjectsNotFound() {
  return <ProjectsMessage title="No projects yet" detail="Projects will appear here soon." />;
}

function ProjectsMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen bg-background px-6 pb-24 pt-36 text-foreground md:px-10 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Home
        </Link>
        <h1 className="mt-24 font-heading text-4xl font-medium tracking-tight">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
      </div>
    </main>
  );
}

function ProjectsIndex() {
  const { data: projects } = useSuspenseQuery(projectsQueryOptions);

  return (
    <main className="min-h-screen bg-background px-6 pb-28 pt-32 text-foreground md:px-10 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-baseline justify-between border-b border-border pb-5">
          <h1 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Projects</h1>
          <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Home
          </Link>
        </div>

        <ol className="divide-y divide-border border-b border-border">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to="/projects/$slug"
                params={{ slug: project.slug }}
                className="group flex items-baseline justify-between gap-6 py-7 transition-colors hover:text-muted-foreground md:py-10"
              >
                <span className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
                  {project.title}
                </span>
                <span className="flex-none text-sm text-muted-foreground">{project.year ?? ""}</span>
              </Link>
            </li>
          ))}
        </ol>

        {projects.length === 0 && (
          <p className="py-10 text-sm text-muted-foreground">No published projects yet.</p>
        )}
      </div>
    </main>
  );
}
