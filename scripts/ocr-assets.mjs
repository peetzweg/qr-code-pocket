// Copies the OCR engine and its Japanese + English models into public/ocr, so text detection works
// offline and never touches a CDN. Generated output; public/ocr is gitignored.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const out = new URL("../public/ocr/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const tesseract = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(createRequire(join(tesseract, "x.js")).resolve("tesseract.js-core/package.json"));
const copy = (from, name) => {
  const to = join(out, name);
  if (!existsSync(to)) copyFileSync(from, to);
};

copy(join(tesseract, "dist/worker.min.js"), "worker.min.js");
// LSTM-only builds: the worker picks the fastest one this device supports and fetches only that.
for (const f of readdirSync(core)) if (/lstm\.wasm\.js$/.test(f)) copy(join(core, f), f);
for (const lang of ["jpn", "eng"]) {
  const pkg = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  copy(join(pkg, "4.0.0_best_int", `${lang}.traineddata.gz`), `${lang}.traineddata.gz`);
}
console.log("ocr assets ready in public/ocr");

// pdf.js side files: CMaps (needed to read Japanese text out of PDFs), the standard fonts, and the
// image decoders. Fetched on demand, cached by the service worker.
import { cpSync } from "node:fs";
const pdfjs = dirname(require.resolve("pdfjs-dist/package.json"));
const pdfOut = new URL("../public/pdfjs/", import.meta.url).pathname;
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) cpSync(join(pdfjs, dir), join(pdfOut, dir), { recursive: true });
console.log("pdf.js assets ready in public/pdfjs");
