import { prepareZXingModule, readBarcodes, writeBarcode, type ReaderOptions } from "zxing-wasm/full";
import wasmUrl from "zxing-wasm/full/zxing_full.wasm?url";

// Served with the app (and precached), never from a CDN: scanning has to work offline.
prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) } });

export interface Found {
  format: string;
  text: string;
  bytes?: Uint8Array;
  /** Bounding box in the image's pixels. */
  box: { x: number; y: number; w: number; h: number };
}

/** Everything a travel ticket might carry: QR, Aztec (boarding passes), PDF417, Data Matrix, barcodes. */
const FORMATS: ReaderOptions["formats"] = ["QRCode", "MicroQRCode", "RMQRCode", "Aztec", "PDF417", "DataMatrix", "Code128", "Code39", "EAN13", "ITF"];

export async function findCodes(image: ImageData, fast = false): Promise<Found[]> {
  const results = await readBarcodes(image, {
    formats: FORMATS,
    tryHarder: !fast,
    tryRotate: !fast,
    tryInvert: !fast,
    tryDownscale: true,
    maxNumberOfSymbols: fast ? 1 : 12,
  });
  const seen = new Set<string>();
  const found: Found[] = [];
  for (const r of results) {
    if (!r.isValid || seen.has(r.text + r.format)) continue;
    seen.add(r.text + r.format);
    const p = r.position;
    const xs = [p.topLeft.x, p.topRight.x, p.bottomLeft.x, p.bottomRight.x];
    const ys = [p.topLeft.y, p.topRight.y, p.bottomLeft.y, p.bottomRight.y];
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    found.push({
      format: r.format,
      text: r.text,
      // Binary payloads (some ticket systems) don't survive a trip through a string.
      bytes: r.contentType === "Binary" || r.contentType === "Mixed" ? r.bytes : undefined,
      box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
    });
  }
  // Top to bottom, as they appear on the page.
  return found.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
}

const svgCache = new Map<string, Promise<string>>();

/** A crisp SVG of the code, redrawn from its payload: easier to scan than any screenshot. */
export function codeSvg(format: string, text: string, bytes?: ArrayBuffer): Promise<string> {
  const key = `${format}:${text}`;
  let svg = svgCache.get(key);
  if (!svg) {
    const input = bytes ? new Uint8Array(bytes) : text;
    svg = writeBarcode(input, { format: format as never, options: format === "QRCode" ? "ecLevel=M" : "", withQuietZones: true }).then((r) => {
      if (r.error || !r.svg) throw new Error(r.error || "Couldn't draw this code");
      return scalable(r.svg);
    });
    svgCache.set(key, svg);
    svg.catch(() => svgCache.delete(key));
  }
  return svg;
}

export async function codePng(format: string, text: string, bytes?: ArrayBuffer, scale = 12): Promise<Blob> {
  const input = bytes ? new Uint8Array(bytes) : text;
  const r = await writeBarcode(input, { format: format as never, scale, withQuietZones: true });
  if (r.error || !r.image) throw new Error(r.error || "Couldn't draw this code");
  return r.image;
}

/** Linear barcodes are wide and short; matrix codes are square. */
export const isLinear = (format: string) => /^(Code|EAN|UPC|ITF|Codabar|DataBar)/.test(format);
export const isStacked = (format: string) => format === "PDF417";

/** zxing's SVG has a fixed pixel size and no viewBox; give it one so it scales to any size, crisply. */
function scalable(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<!DOCTYPE[^>]*>\s*/i, "")
    .replace(/<svg([^>]*?)\swidth="([\d.]+)"\s+height="([\d.]+)"/, '<svg$1 viewBox="0 0 $2 $3" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"');
}
