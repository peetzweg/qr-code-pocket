// Renders every QR style for a few real-world payloads, rasterises them in Chrome at phone-ish sizes,
// and decodes the pixels with zxing. A style ships only if every payload decodes back byte for byte.
//   node scripts/qr-scan-test.mjs   (needs playwright-core and Chrome; run from the repo root)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { prepareZXingModule, readBarcodes, writeBarcode } from "zxing-wasm/full";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright-core");
prepareZXingModule({ overrides: { wasmBinary: readFileSync(new URL("../node_modules/zxing-wasm/dist/full/zxing_full.wasm", import.meta.url)).buffer } });
const { matrixFrom, qrArt, QR_STYLES } = await import(process.env.QRART);

const PAYLOADS = [
  "EXIC:9F3A-22B1-0010-7788-NOZOMI23-20261110",
  "https://www.klook.com/voucher/?orderNo=KL93847261&visitDate=20261115",
  "M1POLOCZEK/PHILIP     EXK7Q2P HNDFUKNH 0241 324Y012A0001 100",
  "ICHIRAN-ORDER-0457",
];
const SIZES = [260, 150];
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 600, height: 600 } });
const rows = [];
for (const style of QR_STYLES.map((s) => s.id)) {
  const res = [];
  for (const text of PAYLOADS) {
    const w = await writeBarcode(text, { format: "QRCode", options: "ecLevel=H", withQuietZones: false });
    const svg = qrArt(matrixFrom(w.symbol), style, { bytes: new TextEncoder().encode(text), ink: process.env.INK ?? "#000", paper: process.env.PAPER });
    for (const px of SIZES) {
      await page.setContent(`<body style="margin:0;background:#fff"><div id="c" style="display:inline-block;padding:12px;background:${process.env.PAPER ?? "#fff"};line-height:0">${svg.replace("<svg", `<svg width="${px}" height="${px}"`)}</div></body>`);
      const png = await page.locator("#c").screenshot();
      const out = await readBarcodes(new Uint8Array(png), { formats: ["QRCode"], tryHarder: false });
      res.push(out[0]?.text === text);
    }
  }
  rows.push([style, res.filter(Boolean).length, res.length]);
  console.log(`${style.padEnd(9)} ${res.map((r) => (r ? "✓" : "✗")).join(" ")}  ${res.filter(Boolean).length}/${res.length}`);
}
await browser.close();
