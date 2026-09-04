import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { EditorialMosaic } from "@/components/editorial-mosaic";
import { getPublishedProject } from "@/lib/projects.functions";

const DESCRIPTION = "A photographic project by Gergely Verhoczki.";
const SITE_URL = "https://gergelyverhoczki.com";

const projectQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["published-project", slug],
    queryFn: () => getPublishedProject({ data: { slug } }),
  });

export const Route = createFileRoute("/projects/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQueryOptions(params.slug)).then((project) => {
      if (!project) throw notFound();
      return project;
    }),
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — Gergely Verhoczki` : "Project — Gergely Verhoczki";
    const description = loaderData?.description || DESCRIPTION;
    const cover = loaderData?.photos[0]?.src;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(cover?.startsWith("https://")
          ? [
              { property: "og:image", content: cover },
              { name: "twitter:image", content: cover },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/projects/${loaderData?.slug ?? ""}` }],
    };
  },
  errorComponent: ProjectError,
  notFoundComponent: ProjectNotFound,
  component: ProjectPage,
});

function ProjectError() {
  return <ProjectMessage title="Project unavailable" detail="This project could not be loaded." />;
}

function ProjectNotFound() {
  return <ProjectMessage title="Project not found" detail="The project may have moved or is no longer published." />;
}

function ProjectMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen bg-background px-6 pb-24 pt-36 text-foreground md:px-10 md:pt-44">
      <div className="mx-auto max-w-7xl">
        <Link to="/projects" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Projects
        </Link>
        <h1 className="mt-24 font-heading text-4xl font-medium tracking-tight">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
      </div>
    </main>
  );
}

function ProjectPage() {
  const { data: project } = useSuspenseQuery(projectQueryOptions(Route.useParams().slug));

  if (!project)
    return <ProjectMessage title="Project not found" detail="The project may have moved or is no longer published." />;

  return (
    <main className="min-h-screen bg-background px-5 pb-28 pt-32 text-foreground md:px-6 md:pt-40">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-14 flex items-baseline justify-between gap-6 md:mb-24">
          <div>
            <Link to="/projects" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              ← Projects
            </Link>
            <h1 className="mt-8 font-heading text-4xl font-medium tracking-tight md:text-6xl">{project.title}</h1>
          </div>
          {project.year && <p className="text-sm text-muted-foreground">{project.year}</p>}
        </div>
        <EditorialMosaic photos={project.photos} onOpen={() => undefined} />
      </div>
    </main>
  );
}
