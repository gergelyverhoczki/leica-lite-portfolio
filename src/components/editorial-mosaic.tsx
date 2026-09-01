import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type MosaicPhotoItem = { id: string; src: string; alt: string };

const DEFAULT_RATIO = 3 / 2;

function useContainerWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(node.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function useAspectRatios(photos: MosaicPhotoItem[]) {
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    photos.forEach((photo) => {
      const img = new Image();
      img.decoding = "async";
      img.src = photo.src;
      const apply = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
        const ratio = img.naturalWidth / img.naturalHeight;
        setRatios((prev) => (prev[photo.id] === ratio ? prev : { ...prev, [photo.id]: ratio }));
      };
      if (img.complete) apply();
      else img.addEventListener("load", apply, { once: true });
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  return ratios;
}

type Entry = { photo: MosaicPhotoItem; index: number; ratio: number };
type Recipe = { count: number; frac: number; align: "start" | "center" | "end"; space: number };

/** Deterministic editorial rhythm — varied spreads, never a repeating 50/50 cadence. */
const DESKTOP_RECIPES: Recipe[] = [
  { count: 1, frac: 1, align: "center", space: 1.6 }, // full-width anchor
  { count: 2, frac: 1, align: "start", space: 1 },
  { count: 1, frac: 0.52, align: "start", space: 1.8 }, // single quiet moment
  { count: 3, frac: 1, align: "start", space: 1 },
  { count: 2, frac: 0.86, align: "end", space: 1.4 },
  { count: 1, frac: 0.72, align: "center", space: 1.8 },
  { count: 3, frac: 1, align: "start", space: 1 },
  { count: 2, frac: 1, align: "start", space: 1.6 },
  { count: 1, frac: 0.62, align: "end", space: 1.8 },
  { count: 2, frac: 0.92, align: "start", space: 1 },
];

const TABLET_RECIPES: Recipe[] = [
  { count: 1, frac: 1, align: "center", space: 1.4 },
  { count: 2, frac: 1, align: "start", space: 1 },
  { count: 1, frac: 0.7, align: "start", space: 1.6 },
  { count: 2, frac: 0.92, align: "end", space: 1 },
  { count: 1, frac: 0.85, align: "center", space: 1.6 },
  { count: 2, frac: 1, align: "start", space: 1 },
];

type Row = {
  entries: Entry[];
  height: number;
  frac: number;
  align: Recipe["align"];
  spaceAfter: number;
};

function buildRows(
  entries: Entry[],
  containerWidth: number,
  gap: number,
  mode: "mobile" | "tablet" | "desktop",
): Row[] {
  if (mode === "mobile") {
    return entries.map((entry, i) => {
      const portrait = entry.ratio < 0.95;
      const frac = portrait ? 0.9 : i % 3 === 1 ? 0.88 : 1;
      const align: Recipe["align"] = portrait ? (i % 2 === 0 ? "start" : "end") : "center";
      const width = containerWidth * frac;
      return {
        entries: [entry],
        height: width / entry.ratio,
        frac,
        align,
        spaceAfter: portrait ? 1.3 : 1,
      };
    });
  }

  const recipes = mode === "tablet" ? TABLET_RECIPES : DESKTOP_RECIPES;
  const rows: Row[] = [];
  let i = 0;
  let r = 0;

  while (i < entries.length) {
    const recipe = recipes[r % recipes.length]!;
    r += 1;

    let count = Math.min(recipe.count, entries.length - i);
    const slice = entries.slice(i, i + count);

    // Avoid awkwardly thin rows: a trio of wide panoramas gets trimmed to a pair.
    const ratioSum = slice.reduce((sum, e) => sum + e.ratio, 0);
    if (count === 3 && ratioSum > 5.4) {
      count = 2;
      slice.length = 2;
    }
    // A lone panorama always spans the full width.
    const frac = count === 1 && slice[0]!.ratio > 2 ? 1 : recipe.frac;

    const sum = slice.reduce((s, e) => s + e.ratio, 0);
    const available = containerWidth * frac - gap * (count - 1);
    let height = available / sum;

    // Keep a single dominant image from towering over the viewport.
    const maxHeight = mode === "tablet" ? 760 : 900;
    if (height > maxHeight) height = maxHeight;

    rows.push({
      entries: slice,
      height,
      frac,
      align: recipe.align,
      spaceAfter: recipe.space,
    });
    i += count;
  }

  return rows;
}

function MosaicImage({
  entry,
  height,
  onOpen,
  eager,
}: {
  entry: Entry;
  height: number;
  onOpen: (index: number) => void;
  eager: boolean;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((it) => it.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <button
      ref={ref}
      onClick={() => onOpen(entry.index)}
      aria-label={`Open photograph ${entry.index + 1}`}
      className="group block cursor-zoom-in"
      style={{ width: entry.ratio * height, height, flexGrow: entry.ratio, flexBasis: 0 }}
    >
      <img
        src={entry.photo.src}
        alt={entry.photo.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={{ aspectRatio: entry.ratio }}
        className={`block h-full w-full object-contain transition-opacity duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}

export function EditorialMosaic({
  photos,
  startIndex = 0,
  onOpen,
}: {
  photos: MosaicPhotoItem[];
  startIndex?: number;
  onOpen: (index: number) => void;
}) {
  const { ref, width } = useContainerWidth();
  const ratios = useAspectRatios(photos);

  const mode: "mobile" | "tablet" | "desktop" =
    width < 700 ? "mobile" : width < 1100 ? "tablet" : "desktop";
  const gap = mode === "mobile" ? 14 : mode === "tablet" ? 18 : 24;
  const baseSpace = mode === "mobile" ? 26 : mode === "tablet" ? 40 : 56;

  const rows = useMemo(() => {
    if (width <= 0) return [] as Row[];
    const entries: Entry[] = photos.map((photo, i) => ({
      photo,
      index: startIndex + i,
      ratio: ratios[photo.id] ?? DEFAULT_RATIO,
    }));
    return buildRows(entries, width, gap, mode);
  }, [photos, ratios, width, gap, mode, startIndex]);

  return (
    <div ref={ref} className="w-full">
      {rows.map((row, ri) => (
        <div
          key={row.entries.map((e) => e.photo.id).join("-")}
          className="flex transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            gap,
            width: `${row.frac * 100}%`,
            marginLeft: row.align === "end" ? "auto" : row.align === "center" ? "auto" : undefined,
            marginRight:
              row.align === "start" ? "auto" : row.align === "center" ? "auto" : undefined,
            marginBottom: ri === rows.length - 1 ? 0 : baseSpace * row.spaceAfter,
          }}
        >
          {row.entries.map((entry) => (
            <MosaicImage
              key={entry.photo.id}
              entry={entry}
              height={row.height}
              onOpen={onOpen}
              eager={ri < 1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
