import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";

import { listPhotos } from "@/lib/photos.functions";

const photosQueryOptions = queryOptions({
  queryKey: ["photos"],
  queryFn: () => listPhotos(),
});

const DESCRIPTION =
  "A minimalist photography portfolio inspired by the precision and restraint of Leica.";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(photosQueryOptions),
  head: ({ loaderData }) => {
    const cover = loaderData?.find((photo) => photo.src.startsWith("https://"))?.src;

    return {
      meta: [
        { title: "Gergely Verhoczki — Photography" },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: "Gergely Verhoczki — Photography" },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(cover
          ? [
              { property: "og:image", content: cover },
              { name: "twitter:image", content: cover },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: "/" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Person",
                name: "Gergely Verhoczki",
                jobTitle: "Photographer",
                description: DESCRIPTION,
                email: "mailto:hello@verhoczki.com",
                ...(cover ? { image: cover } : {}),
              },
              {
                "@type": "ImageGallery",
                name: "Gergely Verhoczki — Selected Work",
                description: DESCRIPTION,
                author: { "@type": "Person", name: "Gergely Verhoczki" },
                image: (loaderData ?? [])
                  .filter((photo) => photo.src.startsWith("https://"))
                  .map((photo) => ({
                    "@type": "ImageObject",
                    contentUrl: photo.src,
                    ...(photo.alt ? { description: photo.alt } : {}),
                  })),
              },
            ],
          }),
        },
      ],
    };
  },
  component: Index,
});


const NAV_LINKS = [
  { href: "#work", label: "Work" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

function Index() {
  const { data: photos } = useSuspenseQuery(photosQueryOptions);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);


  const openLightbox = (index: number) => {
    setIsClosing(false);
    setActiveIndex(index);
  };

  const closeLightbox = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveIndex(null);
      setIsClosing(false);
    }, 300);
  }, []);

  const goNext = useCallback(() => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex + 1) % photos.length);
  }, [activeIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex - 1 + photos.length) % photos.length);
  }, [activeIndex, photos.length]);


  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (activeIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, closeLightbox, goNext, goPrev]);

  useEffect(() => {
    if (activeIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeIndex]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <Link to="/" className="group flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-leica-red transition-transform duration-300 group-hover:scale-125" aria-hidden="true" />
            <span className="font-heading text-lg font-medium tracking-tight">Gergely Verhoczki</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="story-link text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="-mr-2 p-2 text-foreground md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M3 7h18" />
                  <path d="M3 17h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="border-t border-border bg-background md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col px-6 py-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-border/60 py-4 font-heading text-lg font-medium tracking-tight last:border-b-0"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="px-6 pt-40 pb-20 md:px-10 md:pt-52 md:pb-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl fade-in-up">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Documentary Photography
            </p>
            <h1 className="font-heading text-4xl font-medium leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
              Seeing the quiet details others pass by.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              A portfolio of street, portrait, and architectural work made with available light and patience.
            </p>
          </div>

          {photos[0] && (
            <button
              onClick={() => openLightbox(0)}
              className="group relative mt-16 block w-full cursor-zoom-in overflow-hidden rounded-sm"
              aria-label="Open featured photograph"
            >
              <img
                src={photos[0].src}
                alt={photos[0].alt}
                width={1600}
                height={1067}
                className="aspect-[3/2] w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                loading="eager"
              />
              <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/20 to-transparent p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:p-10">
                <span className="rounded-full border border-white/40 px-4 py-2 text-sm text-white">View</span>
              </div>
            </button>
          )}

        </div>
      </section>

      {/* Gallery */}
      <section id="work" className="px-6 py-20 md:px-10 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex items-end justify-between md:mb-16">
            <h2 className="font-heading text-2xl font-medium tracking-tight md:text-3xl">Selected Work</h2>
            <span className="text-sm text-muted-foreground">{photos.length} photographs</span>
          </div>

          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => openLightbox(index)}
                className="group relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden"
                aria-label={`Open photograph ${index + 1}`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  width={1600}
                  height={1067}

                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-border px-6 py-20 md:px-10 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:gap-20">
          <div>
            <h2 className="font-heading text-2xl font-medium tracking-tight md:text-3xl">About</h2>
          </div>
          <div className="space-y-6">
            <p className="text-lg leading-relaxed text-foreground md:text-xl">
              I photograph the space between moments — the hesitation before a stranger enters the frame, the last light
              on a building facade, the stillness of an ordinary object made extraordinary by attention.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              My practice is rooted in available light and slow observation. I work primarily with rangefinder cameras
              and prime lenses, preferring restraint over spectacle and quiet precision over noise.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-6">
              <div>
                <p className="font-heading text-3xl font-medium">12</p>
                <p className="mt-1 text-sm text-muted-foreground">Years photographing</p>
              </div>
              <div>
                <p className="font-heading text-3xl font-medium">24</p>
                <p className="mt-1 text-sm text-muted-foreground">Countries documented</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border px-6 py-20 md:px-10 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 md:grid-cols-2 md:gap-20">
            <div>
              <h2 className="font-heading text-2xl font-medium tracking-tight md:text-3xl">Get in touch</h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Open for commissions, editorial work, and print inquiries.
              </p>
            </div>
            <div className="space-y-6">
              <a
                href="mailto:hello@verhoczki.com"
                className="block font-heading text-2xl font-medium transition-colors hover:text-leica-red md:text-3xl"
              >
                hello@verhoczki.com
              </a>
              <div className="flex flex-wrap gap-6 text-sm font-medium text-muted-foreground">
                <a href="#" className="story-link transition-colors hover:text-foreground">Instagram</a>
                <a href="#" className="story-link transition-colors hover:text-foreground">Prints</a>
                <a href="#" className="story-link transition-colors hover:text-foreground">Newsletter</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Gergely Verhoczki. All rights reserved.</p>
          <p>Made with patience and available light.</p>
        </div>
      </footer>

      {/* Lightbox */}
      {activeIndex !== null && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 md:p-10 ${
            isClosing ? "lightbox-exit" : "lightbox-enter"
          }`}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 z-50 rounded-full p-2 text-white/80 transition-colors hover:text-white md:top-8 md:right-8"
            aria-label="Close lightbox"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 z-50 rounded-full p-3 text-white/70 transition-colors hover:text-white md:left-8"
            aria-label="Previous image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 z-50 rounded-full p-3 text-white/70 transition-colors hover:text-white md:right-8"
            aria-label="Next image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div
            className="relative max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[activeIndex]!.src}
              alt={photos[activeIndex]!.alt}
              className="max-h-[85vh] max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
