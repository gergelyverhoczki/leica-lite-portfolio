import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type GalleryPhotoItem = { id: string; src: string; alt: string };

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

function useAspectRatios(photos: GalleryPhotoItem[]) {
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    photos.forEach((photo) => {
      setRatios((current) => {
        if (current[photo.id]) return current;
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
        return current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  return ratios;
}

type Row = { items: { photo: GalleryPhotoItem; index: number; width: number }[]; height: number };

function buildRows(
  photos: GalleryPhotoItem[],
  ratios: Record<string, number>,
  containerWidth: number,
  gap: number,
  targetHeight: number,
  startIndex: number,
): Row[] {
  const rows: Row[] = [];
  let current: { photo: GalleryPhotoItem; ratio: number; index: number }[] = [];
  let ratioSum = 0;

  const flush = (isLast: boolean) => {
    if (current.length === 0) return;
    const gaps = gap * (current.length - 1);
    const available = containerWidth - gaps;
    let height = available / ratioSum;
    if (isLast && height > targetHeight * 1.35) height = targetHeight;
    const items = current.map((entry) => ({
      photo: entry.photo,
      index: entry.index,
      width: entry.ratio * height,
    }));
    rows.push({ items, height });
    current = [];
    ratioSum = 0;
  };

  photos.forEach((photo, i) => {
    const ratio = ratios[photo.id] ?? DEFAULT_RATIO;
    current.push({ photo, ratio, index: startIndex + i });
    ratioSum += ratio;
    const gaps = gap * (current.length - 1);
    const height = (containerWidth - gaps) / ratioSum;
    if (height <= targetHeight) flush(false);
  });
  flush(true);

  return rows;
}

export function JustifiedGallery({
  photos,
  startIndex = 0,
  onOpen,
}: {
  photos: GalleryPhotoItem[];
  startIndex?: number;
  onOpen: (index: number) => void;
}) {
  const { ref, width } = useContainerWidth();
  const ratios = useAspectRatios(photos);

  const gap = width < 640 ? 8 : 12;
  const targetHeight = width < 640 ? Math.max(width * 0.72, 240) : width < 1024 ? 300 : 420;

  const rows = useMemo(
    () =>
      width > 0 ? buildRows(photos, ratios, width, gap, targetHeight, startIndex) : ([] as Row[]),
    [photos, ratios, width, gap, targetHeight, startIndex],
  );

  return (
    <div ref={ref} className="w-full">
      <div className="flex flex-col" style={{ gap }}>
        {rows.map((row, ri) => (
          <div key={ri} className="flex" style={{ gap }}>
            {row.items.map((item) => (
              <button
                key={item.photo.id}
                onClick={() => onOpen(item.index)}
                aria-label={`Open photograph ${item.index + 1}`}
                className="group block cursor-zoom-in overflow-hidden"
                style={{
                  width: item.width,
                  height: row.height,
                  flexGrow: item.width,
                  flexBasis: 0,
                }}
              >
                <img
                  src={item.photo.src}
                  alt={item.photo.alt}
                  loading={ri < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="block h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                  onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
                  ref={(node) => {
                    if (node?.complete) node.classList.remove("opacity-0");
                  }}
                />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
