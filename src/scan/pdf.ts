import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const base = import.meta.env.BASE_URL;

export interface PdfPage {
  canvas: HTMLCanvasElement;
  text: string;
}

/** Renders each page (up to `maxPages`) for code detection, and pulls its text layer for suggestions. */
export async function readPdf(data: ArrayBuffer, maxPages = 12): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data,
    cMapUrl: `${base}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
    wasmUrl: `${base}pdfjs/wasm/`,
    iccUrl: `${base}pdfjs/iccs/`,
  });
  const doc: PDFDocumentProxy = await task.promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
    const page = await doc.getPage(n);
    const unscaled = page.getViewport({ scale: 1 });
    // ~2000 px across: plenty for small QR codes printed on an A4 voucher.
    const viewport = page.getViewport({ scale: Math.min(4, 2000 / unscaled.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
      .join("")
      .replace(/[ \t]+\n/g, "\n");
    pages.push({ canvas, text });
    page.cleanup();
  }
  await task.destroy();
  return pages;
}
