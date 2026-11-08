/** Canvas helpers: decode an image file, crop the code out of it, shrink it for storage and OCR. */

export async function loadImage(blob: Blob): Promise<HTMLCanvasElement> {
  // createImageBitmap honours EXIF orientation by default in current browsers.
  const bitmap = await createImageBitmap(blob);
  const canvas = toCanvas(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return canvas;
}

export function toCanvas(source: CanvasImageSource, width: number, height: number, maxSide = 4096): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export const pixels = (canvas: HTMLCanvasElement) =>
  canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);

export function scaled(canvas: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  if (Math.max(canvas.width, canvas.height) <= maxSide) return canvas;
  return toCanvas(canvas, canvas.width, canvas.height, maxSide);
}

export function crop(canvas: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }, margin = 0.12): HTMLCanvasElement {
  const m = Math.max(box.w, box.h) * margin;
  const x = Math.max(0, Math.floor(box.x - m));
  const y = Math.max(0, Math.floor(box.y - m));
  const w = Math.min(canvas.width - x, Math.ceil(box.w + 2 * m));
  const h = Math.min(canvas.height - y, Math.ceil(box.h + 2 * m));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return out;
}

export const toBlob = (canvas: HTMLCanvasElement, type = "image/png", quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode image"))), type, quality));

/** The source kept for memories: big enough to read, small enough to keep hundreds of. */
export const sourceJpeg = (canvas: HTMLCanvasElement) => toBlob(scaled(canvas, 1800), "image/jpeg", 0.82);
