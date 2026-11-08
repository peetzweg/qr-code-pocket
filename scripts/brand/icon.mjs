// The app icon, drawn from a real QR code in the app's own "liquid" style: white on sumi ink, inside
// the crop frame (+ marks, dashes half a + long). Writes public/favicon.svg (the source for every
// PNG icon and launch screen; see pwa-assets.config.ts).
//   node scripts/brand/icon.mjs   (needs a build of src/ui/qrart.ts at $QRART)
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../../", import.meta.url).pathname;
const z = await import(root + "node_modules/zxing-wasm/dist/es/full/index.js");
z.prepareZXingModule({ overrides: { wasmBinary: readFileSync(root + "node_modules/zxing-wasm/dist/full/zxing_full.wasm").buffer } });
const { matrixFrom, qrArt } = await import(process.env.QRART);

const INK = "#1c1c1c", PAPER = "#ffffff", S = 512;
const w = await z.writeBarcode("QR", { format: "QRCode", options: "ecLevel=L", withQuietZones: false });
const m = matrixFrom(w.symbol);
const inner = qrArt(m, "liquid", { ink: PAPER, quiet: 0 }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

// Code box: 50% of the icon, centred: inside the maskable safe zone with the frame round it.
const box = 256, x0 = (S - box) / 2, y0 = (S - box) / 2, n = m.size;
const o = 30, arm = 20, dash = 20, sw = 7;
const corners = [[x0 - o, y0 - o], [x0 + box + o, y0 - o], [x0 - o, y0 + box + o], [x0 + box + o, y0 + box + o]];
const plus = corners.map(([cx, cy]) => `M${cx - arm} ${cy}H${cx + arm}M${cx} ${cy - arm}V${cy + arm}`).join("");
function dashes(x1, y1, x2, y2) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  const span = L - 2 * arm, gap0 = 14, k = Math.max(1, Math.floor((span - gap0) / (dash + gap0)));
  const g = (span - k * dash) / (k + 1);
  let d = "";
  for (let i = 0; i < k; i++) {
    const a = arm + g + i * (dash + g);
    d += `M${(x1 + ux * a).toFixed(1)} ${(y1 + uy * a).toFixed(1)}L${(x1 + ux * (a + dash)).toFixed(1)} ${(y1 + uy * (a + dash)).toFixed(1)}`;
  }
  return d;
}
const [a, b, c, d] = corners;
const frame = dashes(...a, ...b) + dashes(...c, ...d) + dashes(...a, ...c) + dashes(...b, ...d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${INK}"/>
  <svg x="${x0}" y="${y0}" width="${box}" height="${box}" viewBox="0 0 ${n} ${n}">${inner}</svg>
  <path d="${plus}" stroke="${PAPER}" stroke-width="${sw}" fill="none"/>
  <path d="${frame}" stroke="${PAPER}" stroke-width="${sw}" fill="none"/>
</svg>
`;
writeFileSync(root + "public/favicon.svg", svg);
console.log("public/favicon.svg", svg.length, "bytes,", n, "modules");
