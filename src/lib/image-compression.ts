const MAX_WIDTH = 1600;
const TARGET_BYTES = 200 * 1024;
const MIN_QUALITY = 0.5;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies the EXIF orientation, so portrait phone photos
      // stay upright (and the bitmap reports already-rotated dimensions).
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older browsers reject the options bag; fall through to <img>, which
      // applies EXIF orientation by default (image-orientation: from-image).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Resize an image to at most 1600px wide and compress it towards ~200KB.
 * Returns a JPEG File. Falls back to the original file if anything fails.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await loadBitmap(file);
    const sourceWidth = "width" in bitmap ? bitmap.width : 0;
    const sourceHeight = "height" in bitmap ? bitmap.height : 0;
    if (!sourceWidth || !sourceHeight) return file;

    const scale = Math.min(1, MAX_WIDTH / sourceWidth);
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    if ("close" in bitmap) bitmap.close();

    let quality = 0.85;
    let blob = await toBlob(canvas, quality);
    while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
      blob = await toBlob(canvas, quality);
    }
    if (!blob) return file;
    if (blob.size >= file.size && scale === 1) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
