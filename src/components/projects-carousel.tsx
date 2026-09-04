import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CarouselProject } from "@/lib/projects.functions";

type Props = { projects: CarouselProject[] };

export function ProjectsCarousel({ projects }: Props) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const items = projects.filter((project) => project.cover);

  const syncEdges = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= 8);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncEdges();
  }, [syncEdges, items.length]);

  const scrollBy = (direction: 1 | -1) => {
    const node = trackRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.7, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <section id="projects" className="overflow-hidden border-t border-border px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between gap-6">
          <h2 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Projects</h2>
          {items.length > 1 && (
            <div className="hidden gap-4 md:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={atStart}
                aria-label="Previous projects"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={atEnd}
                aria-label="Next projects"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                →
              </button>
            </div>
          )}
        </div>

        <ul
          ref={trackRef}
          onScroll={syncEdges}
          className="mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 md:mt-10 md:gap-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((project) => (
            <li
              key={project.id}
              className="w-[82%] flex-none snap-start sm:w-[60%] md:w-[46%] lg:w-[40%]"
            >
              <Link
                to="/projects/$slug"
                params={{ slug: project.slug }}
                className="group block"
                aria-label={`View project ${project.title}`}
              >
                <div className="overflow-hidden rounded-sm">
                  <img
                    src={project.cover!.src}
                    alt={project.cover!.alt || `${project.title} — project cover photograph`}
                    {...(project.cover!.width && project.cover!.height
                      ? { width: project.cover!.width, height: project.cover!.height }
                      : {})}
                    loading="lazy"
                    className="h-auto w-full object-contain transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                  />
                </div>
                <h3 className="mt-4 font-heading text-sm uppercase tracking-[0.16em]">{project.title}</h3>
                <span className="mt-1 inline-block text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                  View project →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
