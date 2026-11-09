import { imageUrl, type Pass } from "../store/db";
import { colours, getTheme } from "../theme";
import { longDate, prettyFormat } from "./format";
import { postmarkDate, postmarkSvg } from "./Postmark";
import { bytesOf, microline, serialOf } from "./print";
import { barcodeInk, codeSvgArt, isQr } from "./qr";
import { HOUSE_STYLE } from "./qrart";
import { outline, shapeOf } from "./shapes";
import { ticketText } from "./ticketText";

/**
 * The ticket as a picture to share: the same print as on screen (its kind's die-cut outline, title,
 * time, tear line with microprint, the code in its running microprint frame, the stamp if used, the
 * bit strip and serial), in the wallet's two colours, at 1080 × 1620. Drawn on a canvas with the
 * app's own fonts. Geometry from the app is scaled by K, so the shapes match exactly.
 */
const K = 2.6;
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

/**
 * The code's content set round a rounded rectangle, clockwise from the middle of the top-left corner
 * (where a dot covers the join), like the running frame on an open ticket (CodeLoop.tsx), stood still.
 */
function loopText(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, R: number, text: string, size: number, fg: string, bg: string) {
  type Seg = { len: number; at: (d: number) => [number, number, number] };
  const arc = (cx: number, cy: number, a0: number, a1: number): Seg => ({
    len: R * (a1 - a0),
    at: (d) => {
      const a = a0 + d / R;
      return [cx + R * Math.cos(a), cy + R * Math.sin(a), a + Math.PI / 2];
    },
  });
  const line = (ax: number, ay: number, bx: number, by: number): Seg => {
    const len = Math.hypot(bx - ax, by - ay);
    const ang = Math.atan2(by - ay, bx - ax);
    return { len, at: (d) => [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len, ang] };
  };
  const PI = Math.PI;
  const segs = [
    arc(x0 + R, y0 + R, -0.75 * PI, -0.5 * PI), line(x0 + R, y0, x1 - R, y0),
    arc(x1 - R, y0 + R, -0.5 * PI, 0), line(x1, y0 + R, x1, y1 - R),
    arc(x1 - R, y1 - R, 0, 0.5 * PI), line(x1 - R, y1, x0 + R, y1),
    arc(x0 + R, y1 - R, 0.5 * PI, PI), line(x0, y1 - R, x0, y0 + R),
    arc(x0 + R, y0 + R, PI, 1.25 * PI),
  ];
  const lap = segs.reduce((a, g) => a + g.len, 0);
  const at = (d: number) => {
    for (const g of segs) {
      if (d <= g.len) return g.at(d);
      d -= g.len;
    }
    return segs[segs.length - 1].at(segs[segs.length - 1].len);
  };
  ctx.save();
  ctx.font = `500 ${size}px ${MONO}`;
  spaced(ctx, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const unit = `${text.replace(/\s+/g, " ").trim() || "QR CODE POCKET"} · `;
  const clear = size * 1.1;
  let d = clear;
  for (let i = 0; ; i++) {
    const ch = unit[i % unit.length];
    const adv = ctx.measureText(ch).width;
    if (d + adv > lap - clear) break;
    const [x, y, a] = at(d + adv / 2);
    ctx.setTransform(ctx.getTransform().translate(x, y).rotate((a * 180) / PI));
    ctx.fillText(ch, -adv / 2, 0);
    ctx.setTransform(ctx.getTransform().rotate((-a * 180) / PI).translate(-x, -y));
    d += adv;
  }
  ctx.restore();
  // The dot over the join.
  const [dx, dy] = at(0);
  ctx.beginPath();
  ctx.arc(dx, dy, 4.2 * K, 0, 2 * PI);
  ctx.fillStyle = fg;
  ctx.strokeStyle = bg;
  ctx.lineWidth = 2.5 * K;
  ctx.stroke();
  ctx.fill();
}

async function loadImage(id: string): Promise<HTMLImageElement | undefined> {
  const url = await imageUrl(id);
  if (!url) return;
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img, () => undefined);
}

export async function ticketImage(pass: Pass, codeIndex = 0): Promise<Blob> {
  const theme = getTheme();
  const { fg, bg, codeFg, plainInk } = colours(theme);
  const shape = shapeOf(pass.category);
  const dotted = shape.line === "dotted";
  const used = !!pass.usedAt;
  const logo = pass.logoId ? await loadImage(pass.logoId) : undefined;
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

  // Kicker.
  ctx.font = `500 26px ${MONO}`;
  spaced(ctx, 3);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText([t.issuer, t.cat.label !== t.issuer ? t.cat.label : undefined].filter(Boolean).join(" · ").toUpperCase(), X + P, Y + 84);
  ctx.textAlign = "right";
  ctx.fillText((pass.category === "card" ? t.day ?? "" : pass.date ? longDate(pass.date) : "Undated").toUpperCase(), X + TW - P, Y + 84);
  ctx.textAlign = "left";
  spaced(ctx, 0);

  // Title: as big as fits in two lines.
  let size = 104;
  let lines: string[] = [];
  for (; size >= 54; size -= 6) {
    ctx.font = `400 ${size}px ${SERIF}`;
    lines = wrap(ctx, pass.title || "Untitled", TW - 2 * P - (logo ? 190 : 0));
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

  // A card's logo, full colour, like an app icon.
  if (logo) {
    const ls = 60 * K, lx = X + TW - 16 * K - ls, ly = Y + 40 * K;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(lx, ly, ls, ls, 14 * K);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.clip();
    const r = Math.min(ls / logo.naturalWidth, ls / logo.naturalHeight);
    const iw = logo.naturalWidth * r, ih = logo.naturalHeight * r;
    ctx.drawImage(logo, lx + (ls - iw) / 2, ly + (ls - ih) / 2, iw, ih);
    ctx.restore();
  }

  // The ticket's outline (its kind's shape, notches at the tear), then the tear line, dashed or dotted.
  const tearY = y + 24;
  ctx.save();
  ctx.translate(X, Y);
  ctx.scale(K, K);
  ctx.lineWidth = 3 / K;
  ctx.lineJoin = "miter";
  ctx.stroke(new Path2D(outline(shape, TW / K, TH / K, (tearY - Y) / K)));
  ctx.restore();
  ctx.lineWidth = 2;
  if (dotted) dashed(ctx, X, tearY, X + TW, tearY, 16 * K, 1.5 * K, 3 * K);
  else dashed(ctx, X, tearY, X + TW, tearY, 16 * K, 15, 11);
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
    const svg = await codeSvgArt(code, HOUSE_STYLE, barcodeInk(code.format, codeFg, plainInk));
    // A used code steps back under the stamp, as in the app.
    ctx.globalAlpha = used ? 0.22 : 1;
    if (svg) {
      if (isQr(code.format)) ctx.drawImage(await loadSvg(svg, s), qx, qy, s, s);
      else {
        // A barcode keeps its proportions, on a white plate.
        const vb = svg.match(/viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/);
        const aspect = vb ? +vb[1] / +vb[2] : 3;
        const iw = aspect >= 1 ? s : s * aspect, ih = aspect >= 1 ? s / aspect : s;
        const img = await loadSvg(svg, Math.round(iw), Math.round(ih));
        ctx.fillStyle = "#fff";
        ctx.fillRect(qx + (s - iw) / 2, qy + (s - ih) / 2, iw, ih);
        ctx.drawImage(img, qx + (s - iw) / 2, qy + (s - ih) / 2, iw, ih);
        ctx.fillStyle = fg;
      }
    }
    ctx.globalAlpha = used ? 0.35 : 1;
    // Frame: the code's content as microprint round it, as on an open ticket.
    const o = 10 * K;
    loopText(ctx, qx - o, qy - o, qx + s + o, qy + s + o, 11 * K, code.text, 5.6 * K, fg, bg);
    ctx.globalAlpha = 1;
  } else {
    // An image ticket keeps the plain crop frame: + marks, dashes (or dots) between them.
    const o = 22, arm = 15;
    ctx.lineWidth = 2;
    for (const [x1, y1, x2, y2] of [
      [qx - o, qy - o, qx + s + o, qy - o], [qx - o, qy + s + o, qx + s + o, qy + s + o],
      [qx - o, qy - o, qx - o, qy + s + o], [qx + s + o, qy - o, qx + s + o, qy + s + o],
    ]) dotted ? dashed(ctx, x1, y1, x2, y2, arm, 1.5 * K, 3 * K) : dashed(ctx, x1, y1, x2, y2, arm, arm, 11);
    ctx.beginPath();
    for (const [cx, cy] of [[qx - o, qy - o], [qx + s + o, qy - o], [qx - o, qy + s + o], [qx + s + o, qy + s + o]]) {
      ctx.moveTo(cx - arm, cy);
      ctx.lineTo(cx + arm, cy);
      ctx.moveTo(cx, cy - arm);
      ctx.lineTo(cx, cy + arm);
    }
    ctx.stroke();
  }
  if (pass.usedAt) {
    const ps = Math.round(s * 0.78);
    const pm = await loadSvg(postmarkSvg(postmarkDate(pass.usedAt), pass.from ?? pass.place, fg, bg, ps), ps, ps);
    ctx.save();
    ctx.translate(qx + s / 2, qy + s / 2);
    ctx.rotate(-0.21);
    ctx.drawImage(pm, -ps / 2, -ps / 2);
    ctx.restore();
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
  ctx.fillText("QR CODE POCKET", W / 2, H - 38);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the ticket"))), "image/png"));
}
