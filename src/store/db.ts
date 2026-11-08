import { openDB, type DBSchema } from "idb";
import type { Category } from "../categories";
import type { QrStyle } from "../ui/qrart";

export interface Code {
  id: string;
  /** zxing's canonical format name: "QRCode", "Aztec", "PDF417", "Code128"... */
  format: string;
  text: string;
  /** The raw payload, kept when it isn't plain text, so the code can be redrawn byte for byte. */
  bytes?: ArrayBuffer;
  /** The code as it appeared in the original image (PNG), for "Show original". */
  cropId?: string;
}

export interface Pass {
  id: string;
  title: string;
  category: Category;
  /** Local date, "YYYY-MM-DD". */
  date?: string;
  /** Local time, "HH:MM". */
  time?: string;
  place?: string;
  from?: string;
  to?: string;
  seat?: string;
  notes?: string;
  codes: Code[];
  /** The whole screenshot or PDF page it came from, for memories and context. */
  sourceId?: string;
  /** Text read from the source (PDF text or OCR), for search and suggestions. */
  text?: string;
  createdAt: number;
  updatedAt: number;
  /** Set when stamped as used; the pass then lives in Collected. */
  usedAt?: number;
  /** This ticket's own QR style; otherwise the wallet's. */
  style?: QrStyle;
}

/**
 * Image bytes. Stored as plain ArrayBuffers rather than Blobs: Safari's IndexedDB can fail to store
 * Blobs ("Error preparing Blob/File data"), which would abort a whole import.
 */
export interface StoredImage {
  id: string;
  data: ArrayBuffer;
  type: string;
}

interface KippuDB extends DBSchema {
  passes: { key: string; value: Pass };
  images: { key: string; value: StoredImage };
}

export const db = openDB<KippuDB>("kippu", 1, {
  upgrade(d) {
    d.createObjectStore("passes", { keyPath: "id" });
    d.createObjectStore("images", { keyPath: "id" });
  },
});

export const uid = () => crypto.randomUUID();

export async function putImage(blob: Blob): Promise<string> {
  const id = uid();
  await (await db).put("images", { id, data: await blob.arrayBuffer(), type: blob.type || "image/png" });
  return id;
}

const urls = new Map<string, Promise<string | undefined>>();

/** An object URL for a stored image, made once per session. */
export function imageUrl(id: string): Promise<string | undefined> {
  let url = urls.get(id);
  if (!url) {
    url = db
      .then((d) => d.get("images", id))
      .then((img) => (img ? URL.createObjectURL(new Blob([img.data], { type: img.type })) : undefined));
    urls.set(id, url);
  }
  return url;
}

export async function getImageBlob(id: string): Promise<Blob | undefined> {
  const img = await (await db).get("images", id);
  return img && new Blob([img.data], { type: img.type });
}

const dataUrls = new Map<string, Promise<string | undefined>>();

/** A data: URL, for images that have to live inside an SVG drawn as an <img> (blob: URLs can't). */
export function imageDataUrl(id: string): Promise<string | undefined> {
  let p = dataUrls.get(id);
  if (!p) {
    p = getImageBlob(id).then(
      (blob) =>
        blob &&
        new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(blob);
        }),
    );
    dataUrls.set(id, p);
  }
  return p;
}
