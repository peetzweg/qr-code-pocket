import type { Category } from "../categories";
import { putImage, type Code } from "../store/db";
import { addPass, findByCode, type NewPass } from "../store/passes";
import type { Suggestions } from "./extract";
import { infer } from "./infer";
import { crop, loadImage, pixels, sourceJpeg, toBlob } from "./image";
import { findCodes, type Found } from "./zxing";

export interface DraftCode extends Omit<Found, "box"> {
  crop?: Blob;
}

/** One thing being added: an image, a PDF, a camera frame or typed text, with what was found in it. */
export interface Draft {
  key: string;
  name: string;
  codes: DraftCode[];
  /** The whole image (or first page with a code), kept for memories. */
  source?: Blob;
  /** Kept only in memory, for OCR. */
  canvas?: HTMLCanvasElement;
  text: string;
  /** "pdf": the text came with the file, no OCR needed. */
  textFrom: "none" | "pdf" | "ocr";
  suggestions: Suggestions;
  /** Codes already saved in another pass. */
  duplicateOf?: string;
}

let n = 0;
const key = () => `d${++n}`;

async function codesFrom(canvas: HTMLCanvasElement, found: Found[]): Promise<DraftCode[]> {
  return Promise.all(
    found.map(async ({ box, ...code }) => ({ ...code, crop: await toBlob(crop(canvas, box)) })),
  );
}

function finish(d: Omit<Draft, "suggestions" | "duplicateOf">): Draft {
  const texts = d.codes.map((c) => c.text);
  return { ...d, suggestions: infer(d.text, d.codes.map((c) => ({ text: c.text, binary: !!c.bytes }))), duplicateOf: texts.map(findByCode).find(Boolean)?.title };
}

/** A copy with the codes painted over: OCR reads QR modules as junk like "[=] 1s [=]". */
function masked(canvas: HTMLCanvasElement, found: Found[]): HTMLCanvasElement {
  if (!found.length) return canvas;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = "#fff";
  for (const { box } of found) {
    const m = Math.max(box.w, box.h) * 0.08;
    ctx.fillRect(box.x - m, box.y - m, box.w + 2 * m, box.h + 2 * m);
  }
  return out;
}

export async function draftFromCanvas(canvas: HTMLCanvasElement, name: string, found?: Found[]): Promise<Draft> {
  found ??= await findCodes(pixels(canvas));
  return finish({
    key: key(),
    name,
    codes: await codesFrom(canvas, found),
    source: await sourceJpeg(canvas),
    canvas: masked(canvas, found),
    text: "",
    textFrom: "none",
  });
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export async function draftFromFile(file: File): Promise<Draft> {
  if (!isPdf(file)) return draftFromCanvas(await loadImage(file), file.name);
  const { readPdf } = await import("./pdf");
  const pages = await readPdf(await file.arrayBuffer());
  const codes: DraftCode[] = [];
  let first: HTMLCanvasElement | undefined;
  for (const page of pages) {
    const found = await findCodes(pixels(page.canvas));
    if (found.length && !first) first = page.canvas;
    for (const c of await codesFrom(page.canvas, found)) if (!codes.some((x) => x.text === c.text)) codes.push(c);
  }
  const canvas = first ?? pages[0]?.canvas;
  // A scanned PDF has no text layer; OCR the page, codes painted out.
  const ocrCanvas = canvas && masked(canvas, first ? await findCodes(pixels(canvas)) : []);
  const text = pages.map((p) => p.text).join("\n").trim();
  return finish({
    key: key(),
    name: file.name,
    codes,
    source: canvas && (await sourceJpeg(canvas)),
    // A PDF without a text layer (a scan) still gets OCR.
    canvas: text ? undefined : ocrCanvas,
    text,
    textFrom: text ? "pdf" : "none",
  });
}

/** For a code you only have as text: a booking number, a link. */
export function draftFromText(text: string): Draft {
  return finish({ key: key(), name: "Typed", codes: [{ format: "QRCode", text }], text: "", textFrom: "none" });
}

export function withText(d: Draft, text: string): Draft {
  return { ...d, text, textFrom: "ocr", suggestions: infer(text, d.codes.map((c) => ({ text: c.text, binary: !!c.bytes }))) };
}

/** Several screenshots of one booking (one per person, say) as a single pass. */
export function combine(drafts: Draft[]): Draft {
  const codes: DraftCode[] = [];
  for (const d of drafts) for (const c of d.codes) if (!codes.some((x) => x.text === c.text)) codes.push(c);
  const text = drafts.map((d) => d.text).filter(Boolean).join("\n");
  return finish({
    key: key(),
    name: `${drafts.length} combined`,
    codes,
    source: drafts.find((d) => d.source)?.source,
    canvas: drafts.find((d) => d.canvas)?.canvas,
    text,
    textFrom: drafts.some((d) => d.textFrom === "pdf") ? "pdf" : text ? "ocr" : "none",
  });
}

export interface PassFields {
  title: string;
  category: Category;
  date?: string;
  time?: string;
  place?: string;
  from?: string;
  to?: string;
  seat?: string;
  notes?: string;
}

export async function saveDraft(d: Draft, fields: PassFields) {
  const codes: Code[] = [];
  for (const c of d.codes) {
    codes.push({
      id: crypto.randomUUID(),
      format: c.format,
      text: c.text,
      bytes: c.bytes ? (c.bytes.slice().buffer as ArrayBuffer) : undefined,
      cropId: c.crop ? await putImage(c.crop) : undefined,
    });
  }
  const pass: NewPass = {
    ...fields,
    codes,
    sourceId: d.source ? await putImage(d.source) : undefined,
    text: d.text || undefined,
  };
  return addPass(pass);
}
