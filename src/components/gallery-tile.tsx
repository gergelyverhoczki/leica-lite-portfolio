export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type GalleryPhotoItem = { id: string; src: string; alt: string };

export function GalleryTile({
  photo,
  index,
  onOpen,
  priority = false,
}: {
  photo: GalleryPhotoItem;
  index: number;
  onOpen: (index: number) => void;
  priority?: boolean;
}) {
  return (
    <button
      onClick={() => onOpen(index)}
      className="group block w-full cursor-zoom-in overflow-hidden break-inside-avoid"
      aria-label={`Open photograph ${index + 1}`}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block aspect-[3/2] h-auto w-full object-contain transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
      />
    </button>
  );
}
