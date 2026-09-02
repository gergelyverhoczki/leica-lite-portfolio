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

function useViewportWidth() {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return width;
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

type Row = {
  entries: Entry[];
  height: number;
  width: number; // px — actual composed width of the row
  align: "start" | "center" | "end";
  spaceAfter: number;
};

type ModeConfig = {
  target: number; // ideal row height in px
  maxHeight: number; // never let a row tower over the viewport
  maxCount: number; // max images per row
  soloEvery: number; // cadence of intentional single-image compositions
  heroEvery: number; // cadence of full-width anchors
  soloMaxWidth: number; // fraction of container for an editorial solo
  portraitSoloMaxWidth: number; // narrower cap for tall images
};

type Mode = "phone" | "compact" | "tablet" | "desktop";

const MODES: Record<"tablet" | "desktop", ModeConfig> = {
  tablet: {
    target: 460,
    maxHeight: 760,
    maxCount: 2,
    soloEvery: 5,
    heroEvery: 7,
    soloMaxWidth: 0.82,
    portraitSoloMaxWidth: 0.6,
  },
  desktop: {
    target: 540,
    maxHeight: 900,
    maxCount: 3,
    soloEvery: 6,
    heroEvery: 9,
    soloMaxWidth: 0.74,
    portraitSoloMaxWidth: 0.48,
  },
};

/* ------------------------------------------------------------------ *
 * Mobile composition system (below 768px)
 * Art-directed rhythm: dominant singles, occasional pairs, occasional
 * smaller supporting frames. Every size derives from the real ratio.
 * ------------------------------------------------------------------ */

type MobileConfig = {
  maxHeight: number; // tallest a single frame may get
  portraitMaxWidth: number; // portraits stay a touch inside the measure
  supportWidth: number; // fraction for the smaller supporting frames
  supportEvery: number; // cadence of supporting frames
  pairEvery: number; // cadence at which a pair is allowed
  minPairHeight: number; // a pair is only worth it if both stay this tall
};

const MOBILE: Record<"phone" | "compact", MobileConfig> = {
  phone: {
    maxHeight: 520,
    portraitMaxWidth: 0.94,
    supportWidth: 0.68,
    supportEvery: 6,
    pairEvery: 3,
    minPairHeight: 150,
  },
  compact: {
    maxHeight: 600,
    portraitMaxWidth: 0.9,
    supportWidth: 0.64,
    supportEvery: 5,
    pairEvery: 3,
    minPairHeight: 190,
  },
};

function buildMobileRows(
  entries: Entry[],
  containerWidth: number,
  gap: number,
  mode: "phone" | "compact",
): Row[] {
  const cfg = MOBILE[mode];
  const rows: Row[] = [];
  let i = 0;
  let slot = 0;

  while (i < entries.length) {
    const first = entries[i]!;
    const next = entries[i + 1];

    // Use a pair only when it makes a genuinely readable, balanced row. The
    // shared height is exact: both natural widths plus the gap fill the measure.
    if (next) {
      const pairHeight = (containerWidth - gap) / (first.ratio + next.ratio);
      const balanced = Math.abs(first.ratio - next.ratio) < 0.65;
      const readable = pairHeight >= cfg.minPairHeight;
      const editorialMoment = slot > 0 && slot % cfg.pairEvery === 0;
      if (balanced && readable && editorialMoment) {
        rows.push({
          entries: [first, next],
          height: pairHeight,
          width: containerWidth,
          align: "start",
          spaceAfter: 1,
        });
        i += 2;
        slot += 1;
        continue;
      }
    }

    // Singles use nearly all of the measure. Only the occasional supporting
    // frame is intentionally narrower, and its height still comes from ratio.
    const isSupport =
      cfg.supportEvery > 0 && slot > 0 && slot % cfg.supportEvery === cfg.supportEvery - 1;
    const requestedWidth = isSupport
      ? containerWidth * cfg.supportWidth
      : first.ratio < 0.9
        ? containerWidth * cfg.portraitMaxWidth
        : containerWidth;
    const width = Math.min(requestedWidth, cfg.maxHeight * first.ratio, containerWidth);

    rows.push({
      entries: [first],
      height: width / first.ratio,
      width,
      align: isSupport ? (slot % 2 === 0 ? "start" : "end") : "center",
      spaceAfter: 1,
    });
    i += 1;
    slot += 1;
  }

  return rows;
}




/**
 * Justified layout: each row's shared height is derived from the row's aspect
 * ratios so that (sum of scaled widths) + gaps == the row width exactly.
 */
function layoutRow(
  slice: Entry[],
  rowWidth: number,
  gap: number,
  cfg: ModeConfig,
): { height: number; width: number } {
  const sum = slice.reduce((s, e) => s + e.ratio, 0);
  const available = rowWidth - gap * (slice.length - 1);
  let height = available / sum;
  let width = rowWidth;
  // Clamping height must shrink the row width too, otherwise a gap appears.
  if (height > cfg.maxHeight) {
    height = cfg.maxHeight;
    width = height * sum + gap * (slice.length - 1);
  }
  return { height, width };
}

function soloWidth(entry: Entry, containerWidth: number, cfg: ModeConfig) {
  // Panoramas earn the full measure; portraits get a controlled editorial cap.
  if (entry.ratio >= 1.9) return containerWidth;
  const frac = entry.ratio < 0.95 ? cfg.portraitSoloMaxWidth : cfg.soloMaxWidth;
  const byWidth = containerWidth * frac;
  const byHeight = cfg.maxHeight * entry.ratio;
  return Math.min(byWidth, byHeight, containerWidth);
}

function buildRows(
  entries: Entry[],
  containerWidth: number,
  gap: number,
  mode: "tablet" | "desktop",
): Row[] {
  const cfg = MODES[mode];
  const rows: Row[] = [];
  let i = 0;
  let rowIndex = 0;

  while (i < entries.length) {
    const remaining = entries.length - i;

    const wantsHero = cfg.heroEvery > 0 && rowIndex % cfg.heroEvery === 0;
    const wantsSolo = cfg.soloEvery > 0 && rowIndex % cfg.soloEvery === cfg.soloEvery - 1;
    const first = entries[i]!;

    // Intentional single-image composition — explicitly sized, never accidental.
    if (cfg.maxCount === 1 || wantsHero || wantsSolo || remaining === 1) {
      const isLast = remaining === 1;
      let width: number;
      if (wantsHero && !wantsSolo) {
        // Full-width anchor, but keep it from towering.
        width = Math.min(containerWidth, cfg.maxHeight * 1.25 * first.ratio);
      } else {
        width = soloWidth(first, containerWidth, cfg);
      }
      const height = width / first.ratio;
      rows.push({
        entries: [first],
        height,
        width,
        align: rowIndex % 3 === 1 ? "end" : rowIndex % 3 === 2 ? "start" : "center",
        spaceAfter: isLast ? 1 : 1.5,
      });

      i += 1;
      rowIndex += 1;
      continue;
    }

    // Greedy justified packing: keep adding images while the resulting shared
    // row height stays above the target for this breakpoint.
    let count = 1;
    let best = 1;
    let bestDelta = Infinity;
    while (count <= Math.min(cfg.maxCount, remaining)) {
      const slice = entries.slice(i, i + count);
      const sum = slice.reduce((s, e) => s + e.ratio, 0);
      const height = (containerWidth - gap * (count - 1)) / sum;
      const delta = Math.abs(height - cfg.target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = count;
      }
      count += 1;
    }
    count = best;

    // Never orphan a single trailing image into an awkward stub row.
    if (remaining - count === 1 && count > 1 && count < Math.min(cfg.maxCount, remaining)) {
      count += 1;
    }

    const slice = entries.slice(i, i + count);
    const { height, width } = layoutRow(slice, containerWidth, gap, cfg);

    rows.push({
      entries: slice,
      height,
      width,
      align: width < containerWidth - 1 ? "center" : "start",
      spaceAfter: 1,
    });
    i += count;
    rowIndex += 1;
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

  // The section has 20px mobile margins, so these container thresholds map to
  // roughly <480px phone, 480–767px compact, then preserve the existing
  // tablet/desktop composition from 768px upward.
  const mode: Mode =
    width < 440 ? "phone" : width < 700 ? "compact" : width < 1100 ? "tablet" : "desktop";
  const isMobile = mode === "phone" || mode === "compact";
  const gap = mode === "phone" ? 10 : mode === "compact" ? 14 : mode === "tablet" ? 18 : 24;
  const baseSpace = mode === "phone" ? 26 : mode === "compact" ? 30 : mode === "tablet" ? 40 : 56;

  const rows = useMemo(() => {
    if (width <= 0) return [] as Row[];
    const entries: Entry[] = photos.map((photo, i) => ({
      photo,
      index: startIndex + i,
      ratio: ratios[photo.id] ?? DEFAULT_RATIO,
    }));
    return isMobile
      ? buildMobileRows(entries, width, gap, mode as "phone" | "compact")
      : buildRows(entries, width, gap, mode as "tablet" | "desktop");
  }, [photos, ratios, width, gap, mode, isMobile, startIndex]);


  return (
    <div ref={ref} className="w-full">
      {rows.map((row, ri) => (
        <div
          key={row.entries.map((e) => e.photo.id).join("-")}
          className="flex transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            gap,
            width: row.width,
            maxWidth: "100%",
            marginLeft: row.align === "end" || row.align === "center" ? "auto" : undefined,
            marginRight: row.align === "start" || row.align === "center" ? "auto" : undefined,
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
