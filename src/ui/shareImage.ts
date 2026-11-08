import type { Pass } from "../store/db";
import { colours, getTheme } from "../theme";
import { longDate, prettyFormat } from "./format";
import { postmarkDate, postmarkSvg } from "./Postmark";
import { bytesOf, microline, serialOf } from "./print";
import { codeSvgArt } from "./qr";
import { ticketText } from "./ticketText";

/**
 * The ticket as a picture to share: the same print as on screen (title, time, notched tear line with
 * microprint, the styled code in its crop frame, the bit strip and serial), in the wallet's two
 * colours, at 1080 × 1620. Drawn on a canvas with the app's own fonts.
 */
const W = 1080;
const H = 1620;
const SERIF = '"Newsreader Variable", "Iowan Old Style", Georgia, serif';
const SANS = '-apple-system, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

function loadSvg(svg: string, w: number, h = w): Promise<HTMLImageElement> {
  // Give the root an explicit pixel size (Safari rasterises SVG images at their own size).
  const sized = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, "").replace(/^<svg/, `<svg width="${w}" height="${h}"`));
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line + w;
    if (ctx.measureText(next.trim()).width > width && line.trim()) {
      lines.push(line.trim());
      line = w.trimStart();
    } else line = next;
  }
  if (line.trim()) lines.push(line.trim());
  // CJK titles have no spaces: break by characters.
  return lines.flatMap((l) => {
    if (ctx.measureText(l).width <= width) return [l];
    const out: string[] = [];
    let cur = "";
    for (const ch of l) {
      if (ctx.measureText(cur + ch).width > width && cur) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    return cur ? [...out, cur] : out;
  });
}

/**
 * Dashes between two marks (corners or notches) `inset` from each end: every dash `dash` long, the
 * gaps evened out so the line starts and ends exactly one gap away from the marks.
 */
function dashed(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, inset: number, dash: number, gap: number) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  const span = L - 2 * inset;
  const n = Math.max(1, Math.floor((span - gap) / (dash + gap)));
  const g = (span - n * dash) / (n + 1);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = inset + g + i * (dash + g);
    ctx.moveTo(x1 + ux * a, y1 + uy * a);
    ctx.lineTo(x1 + ux * (a + dash), y1 + uy * (a + dash));
  }
  ctx.stroke();
}

export async function ticketImage(pass: Pass, codeIndex = 0): Promise<Blob> {
  const theme = getTheme();
  const { fg, bg, codeFg } = colours(theme);
  const code = pass.codes[codeIndex];
  const t = ticketText(pass);
  const bytes = code ? bytesOf(code.text, code.bytes) : new TextEncoder().encode(pass.title);
  await Promise.all([document.fonts.load(`400 96px ${SERIF}`), document.fonts.ready]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;

  // The ticket.
  const X = 60, Y = 60, TW = W - 120, TH = H - 150, P = 56;
  ctx.lineWidth = 3;
  ctx.strokeRect(X, Y, TW, TH);

  // Kicker.
  ctx.font = `500 26px ${MONO}`;
  spaced(ctx, 3);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText([t.issuer, t.cat.label !== t.issuer ? t.cat.label : undefined].filter(Boolean).join(" · ").toUpperCase(), X + P, Y + 84);
  ctx.textAlign = "right";
  ctx.fillText((pass.date ? longDate(pass.date) : "Undated").toUpperCase(), X + TW - P, Y + 84);
  ctx.textAlign = "left";
  spaced(ctx, 0);

  // Title: as big as fits in two lines.
  let size = 104;
  let lines: string[] = [];
  for (; size >= 54; size -= 6) {
    ctx.font = `400 ${size}px ${SERIF}`;
    lines = wrap(ctx, pass.title || "Untitled", TW - 2 * P);
    if (lines.length <= 2) break;
  }
  lines = lines.slice(0, 3);
  let y = Y + 110 + size * 0.92;
  for (const l of lines) {
    ctx.fillText(l, X + P, y);
    y += size * 1.0;
  }

  // Time and the line under it.
  y += 16;
  if (pass.time) {
    ctx.font = `300 150px ${SANS}`;
    spaced(ctx, -4);
    ctx.fillText(pass.time, X + P - 6, y + 112);
    const tw = ctx.measureText(pass.time).width;
    spaced(ctx, 0);
    ctx.font = `500 32px ${SANS}`;
    const sub = [t.sub, pass.seat && !t.sub?.includes(pass.seat) ? pass.seat : undefined].filter(Boolean).join(" · ");
    if (sub) wrap(ctx, sub, TW - 2 * P - tw - 40).slice(0, 2).forEach((l, i) => ctx.fillText(l, X + P + tw + 34, y + 70 + i * 40));
    y += 150;
  } else if (t.sub) {
    ctx.font = `500 34px ${SANS}`;
    ctx.fillText(t.sub, X + P, y + 40);
    y += 70;
  }

  // Tear line with notches and microprint.
  const tearY = y + 24;
  ctx.lineWidth = 2;
  dashed(ctx, X, tearY, X + TW, tearY, 24, 30, 16);
  for (const [cx, start, end] of [[X, -Math.PI / 2, Math.PI / 2], [X + TW, Math.PI / 2, (3 * Math.PI) / 2]] as const) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, tearY, 24, start, end);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, tearY, 24, start, end);
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.font = `500 12px ${MONO}`;
  spaced(ctx, 1.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X + 44, tearY + 6, TW - 88, 20);
  ctx.clip();
  ctx.fillText(microline([pass.title, pass.date, pass.time, pass.from && `${pass.from}>${pass.to ?? ""}`, pass.seat, pass.place, t.info?.reference], code?.text ?? "", 400), X + 44, tearY + 22);
  ctx.restore();
  spaced(ctx, 0);

  // The code in its crop frame.
  const footH = 150;
  const areaTop = tearY + 40;
  const areaBottom = Y + TH - footH;
  const s = Math.floor(Math.min(TW - 2 * P - 90, areaBottom - areaTop - 90));
  const qx = Math.round(X + (TW - s) / 2);
  const qy = Math.round(areaTop + (areaBottom - areaTop - s) / 2);
  if (code) {
    const svg = await codeSvgArt(code, pass.style ?? theme.qrStyle, codeFg);
    if (svg) ctx.drawImage(await loadSvg(svg, s), qx, qy, s, s);
  }
  // Frame: + marks on the corners, dashes as long as a + is wide, evenly spaced between them.
  const o = 22, arm = 15;
  ctx.lineWidth = 2;
  for (const [x1, y1, x2, y2] of [
    [qx - o, qy - o, qx + s + o, qy - o], [qx - o, qy + s + o, qx + s + o, qy + s + o],
    [qx - o, qy - o, qx - o, qy + s + o], [qx + s + o, qy - o, qx + s + o, qy + s + o],
  ]) dashed(ctx, x1, y1, x2, y2, arm, arm * 2, 16);
  ctx.beginPath();
  for (const [cx, cy] of [[qx - o, qy - o], [qx + s + o, qy - o], [qx - o, qy + s + o], [qx + s + o, qy + s + o]]) {
    ctx.moveTo(cx - arm, cy);
    ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm);
    ctx.lineTo(cx, cy + arm);
  }
  ctx.stroke();
  if (pass.usedAt) {
    const pm = await loadSvg(postmarkSvg(postmarkDate(pass.usedAt), pass.from ?? pass.place, fg, bg, Math.round(s * 0.66)), Math.round(s * 0.66), Math.round((s * 0.66 * 120) / 170));
    ctx.drawImage(pm, qx + s * 0.4, qy + s * 0.04);
  }

  // Bit strip and serial.
  const by = Y + TH - footH + 34;
  let bx = X + P;
  const bw = TW - 2 * P;
  for (let i = 0; bx < X + P + bw; i++) {
    const b = bytes[i % Math.max(1, bytes.length)] ?? 0;
    for (let bit = 7; bit >= 0 && bx < X + P + bw; bit--) {
      const w = (b >> bit) & 1 ? 4 : 1.6;
      ctx.fillRect(bx, by, w, 46);
      bx += w + 3.2;
    }
    bx += 5;
  }
  ctx.font = `500 26px ${MONO}`;
  spaced(ctx, 3);
  ctx.fillText(serialOf(bytes).toUpperCase(), X + P, by + 90);
  ctx.textAlign = "right";
  ctx.fillText(code ? `${prettyFormat(code.format)} · ${bytes.length} B`.toUpperCase() : "IMAGE", X + TW - P, by + 90);

  // Colophon.
  ctx.textAlign = "center";
  ctx.font = `500 22px ${MONO}`;
  spaced(ctx, 4);
  ctx.fillText("QR CODE WALLET", W / 2, H - 38);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the ticket"))), "image/png"));
}
