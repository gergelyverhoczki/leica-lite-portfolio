const MAX_WIDTH = 1600;
const TARGET_BYTES = 200 * 1024;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap, close: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = url;
  });
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: image,
    close: () => URL.revokeObjectURL(url),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Resize to at most 1600px wide and re-encode as JPEG, stepping quality down
 * until the result fits under ~200KB. Runs in the browser before upload so the
 * gallery never serves full-resolution originals.
 */
export async function compressImage(file: File): Promise<File> {
  const source = await loadBitmap(file);

  try {
    const scale = Math.min(1, MAX_WIDTH / source.width);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source.draw, 0, 0, width, height);

    let best: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }

    if (!best) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([best], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    source.close();
  }
}
