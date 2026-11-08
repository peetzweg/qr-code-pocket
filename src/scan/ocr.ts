import type { Worker } from "tesseract.js";
import { scaled } from "./image";

/**
 * Text detection runs on the phone: Tesseract's LSTM models for Japanese and English (about 5 MB,
 * served with the app and cached after the first use). One worker, kept warm for the session.
 */
const base = import.meta.env.BASE_URL;
let worker: Promise<Worker> | undefined;

function getWorker() {
  worker ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker(["jpn", "eng"], 1, {
      workerPath: `${base}ocr/worker.min.js`,
      corePath: `${base}ocr`,
      langPath: `${base}ocr`,
      workerBlobURL: false,
    }),
  );
  worker.catch(() => (worker = undefined));
  return worker;
}

/** Warm the engine up while the person is still looking at the review screen. */
export const prepareOcr = () => void getWorker().catch(() => {});

let queue = Promise.resolve("");

export function recognize(canvas: HTMLCanvasElement): Promise<string> {
  // One page at a time; the worker isn't re-entrant.
  const job = queue.then(async () => {
    const w = await getWorker();
    const { data } = await w.recognize(scaled(canvas, 2000));
    return tidy(data.text);
  });
  queue = job.catch(() => "");
  return job;
}

/** Tesseract puts spaces between Japanese characters; take them out, keep them between Latin words. */
export function tidy(text: string): string {
  const cjk = "\\u3000-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef";
  return text
    .replace(new RegExp(`([${cjk}])[ \\t]+(?=[${cjk}])`, "g"), "$1")
    .replace(new RegExp(`([${cjk}])[ \\t]+(?=[0-9])`, "g"), "$1")
    .replace(new RegExp(`([0-9])[ \\t]+(?=[${cjk}])`, "g"), "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
