// The share image (public/og.png, 1200 × 630): name, pitch, and a ticket printed like the app's,
// with a real styled QR code. Rendered in Chrome with the app's fonts.
//   QRART=<build of src/ui/qrart.ts> PLAYWRIGHT=<path to playwright-core> node scripts/brand/og.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const root = new URL("../../", import.meta.url).pathname;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright-core");
const z = await import(root + "node_modules/zxing-wasm/dist/es/full/index.js");
z.prepareZXingModule({ overrides: { wasmBinary: readFileSync(root + "node_modules/zxing-wasm/dist/full/zxing_full.wasm").buffer } });
const { matrixFrom, qrArt } = await import(process.env.QRART);

const INK = "#1c1c1c";
const text = "EXIC:9F3A-22B1-0010-7788-NOZOMI23-20261110";
const w = await z.writeBarcode(text, { format: "QRCode", options: "ecLevel=H", withQuietZones: false });
const qr = qrArt(matrixFrom(w.symbol), "liquid", { ink: INK, quiet: 1, bytes: new TextEncoder().encode(text) });
const font = root + "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2";
const dashes = (dir) => `linear-gradient(to ${dir}, ${INK} 6.5px, transparent 0)`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Newsreader; src: url("file://${font}") format("woff2"); font-weight: 200 800; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: #fff; color: ${INK}; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; overflow: hidden; position: relative; }
.mono { font: 500 15px ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; }
.left { position: absolute; left: 80px; top: 92px; width: 560px; }
h1 { font: 400 108px/0.95 Newsreader, Georgia, serif; letter-spacing: -0.035em; margin-top: 26px; }
p { font-size: 25px; line-height: 1.4; margin-top: 30px; max-width: 520px; }
.foot { position: absolute; left: 80px; bottom: 64px; display: flex; gap: 26px; }
.ticket { position: absolute; left: 720px; top: 70px; width: 400px; height: 640px; border: 2px solid ${INK}; background: #fff; }
.th { padding: 24px 28px 0; }
.k { display: flex; justify-content: space-between; font: 500 12.5px ui-monospace, Menlo, monospace; letter-spacing: .12em; }
.title { font: 400 44px/1 Newsreader, Georgia, serif; letter-spacing: -0.02em; margin-top: 16px; }
.time { display: flex; align-items: flex-end; gap: 14px; margin-top: 18px; }
.time b { font: 300 64px/0.85 -apple-system, "Helvetica Neue", sans-serif; letter-spacing: -0.04em; }
.time span { font-size: 15px; line-height: 1.3; }
.tear { position: relative; height: 26px; margin: 22px -2px 0; }
.tear::before { content: ""; position: absolute; left: 22px; right: 14px; top: 50%; height: 2px; background: ${dashes("right")} 0 0 / 11.5px 2px round; }
.notch { position: absolute; top: 50%; width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 2px solid ${INK}; translate: 0 -50%; }
.notch.l { left: -13px; clip-path: inset(0 0 0 50%); } .notch.r { right: -13px; clip-path: inset(0 50% 0 0); }
.code { position: relative; width: 236px; height: 236px; margin: 46px auto 0; }
.code svg { width: 100%; height: 100%; display: block; }
.edge { position: absolute; }
.edge.h { left: 4px; right: -10px; height: 2px; background: ${dashes("right")} 0 0 / 11.5px 2px round; }
.edge.v { top: 4px; bottom: -10px; width: 2px; background: ${dashes("bottom")} 0 0 / 2px 11.5px round; }
.plus { position: absolute; width: 22px; height: 22px; }
.plus::before, .plus::after { content: ""; position: absolute; background: ${INK}; }
.plus::before { left: 0; right: 0; top: 10px; height: 2px; } .plus::after { top: 0; bottom: 0; left: 10px; width: 2px; }
</style></head><body>
<div class="left">
  <div class="mono">Tickets · entries · reservations</div>
  <h1>QR Code<br>Wallet</h1>
  <p>Every code in one place. Add the screenshot or PDF; it's read on your phone and printed in your style.</p>
</div>
<div class="foot mono"><span>Local-first</span><span>Works offline</span><span>No account</span></div>
<div class="ticket">
  <div class="th">
    <div class="k"><span>SMART EX · TRAIN</span><span>TUE 10 NOV</span></div>
    <div class="title">Nozomi 23 · Tokyo → Kyoto</div>
    <div class="time"><b>10:03</b><span>in 2 days<br>Car 7 · 12A</span></div>
  </div>
  <div class="tear"><i class="notch l"></i><i class="notch r"></i></div>
  <div class="code">
    ${qr}
    <i class="edge h" style="top:-16px"></i><i class="edge h" style="bottom:-16px"></i>
    <i class="edge v" style="left:-16px"></i><i class="edge v" style="right:-16px"></i>
    <i class="plus" style="left:-27px;top:-27px"></i><i class="plus" style="right:-27px;top:-27px"></i>
    <i class="plus" style="left:-27px;bottom:-27px"></i><i class="plus" style="right:-27px;bottom:-27px"></i>
  </div>
</div>
</body></html>`;
writeFileSync("/tmp/kippu-og.html", html);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file:///tmp/kippu-og.html");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: root + "public/og.png" });
await browser.close();
console.log("public/og.png");
