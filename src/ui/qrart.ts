/**
 * The QR code as artwork. The payload never changes; only how its modules are drawn: dots, liquid
 * blobs, pill strokes, molecules, engraved lines, halftone. Codes are encoded at error correction H
 * (30% redundancy) so the styling has room, finder patterns keep their 1:1:3:1:1 proportions, and every
 * style is checked against a real decoder (scripts/qr-scan-test). The plain code stays one tap away.
 */

export interface Matrix {
  size: number;
  dark(x: number, y: number): boolean;
}

/** zxing's writer gives one byte per module: 0 is dark. */
export function matrixFrom(symbol: { data: Uint8Array | Uint8ClampedArray; width: number }): Matrix {
  const { data, width } = symbol;
  return { size: width, dark: (x, y) => x >= 0 && y >= 0 && x < width && y < width && data[y * width + x] === 0 };
}

export type QrStyle = "classic" | "tiles" | "soft" | "dots" | "liquid" | "pills" | "molecule" | "engraved" | "halftone";

/** Shape × joining: sharp or round, merged or separate. Then a few with more character. */
export const QR_STYLES: { id: QrStyle; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Square, merged" },
  { id: "tiles", label: "Tiles", hint: "Square, separate" },
  { id: "liquid", label: "Liquid", hint: "Round, merged" },
  { id: "soft", label: "Soft", hint: "Round, separate" },
  { id: "dots", label: "Dots", hint: "Circles" },
  { id: "molecule", label: "Molecule", hint: "Circles, bonded" },
  { id: "pills", label: "Pills", hint: "Strokes" },
  { id: "engraved", label: "Engraved", hint: "Lines" },
  { id: "halftone", label: "Halftone", hint: "Screen" },
];

const f = (n: number) => +n.toFixed(3);

function inFinder(n: number, x: number, y: number) {
  return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
}

/** The three big corner squares, in a shape that suits the style but keeps its ring proportions. */
function finders(n: number, shape: "square" | "rounded" | "circle", ink: string) {
  const out: string[] = [];
  for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    if (shape === "circle") {
      out.push(`<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="3" fill="none" stroke="${ink}" stroke-width="1"/>`);
      out.push(`<circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="1.5" fill="${ink}"/>`);
    } else {
      const r = shape === "rounded" ? 1.9 : 0;
      const ri = shape === "rounded" ? 0.9 : 0;
      out.push(`<rect x="${ox + 0.5}" y="${oy + 0.5}" width="6" height="6" rx="${r}" fill="none" stroke="${ink}" stroke-width="1"/>`);
      out.push(`<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="${ri}" fill="${ink}"/>`);
    }
  }
  return out.join("");
}

/** A small deterministic wobble per module, from the payload, for styles that vary size or phase. */
function jitter(bytes: Uint8Array | undefined, i: number) {
  if (!bytes?.length) return 0.5;
  return bytes[i % bytes.length] / 255;
}

function body(m: Matrix, style: QrStyle, ink: string, bytes?: Uint8Array): string {
  const n = m.size;
  const d = (x: number, y: number) => m.dark(x, y) && !inFinder(n, x, y);
  let p = "";
  switch (style) {
    case "classic": {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d(x, y)) p += `M${x} ${y}h1v1h-1z`;
      return `<path d="${p}" fill="${ink}"/>`;
    }
    case "tiles": {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d(x, y)) p += `M${x + 0.09} ${y + 0.09}h0.82v0.82h-0.82z`;
      return `<path d="${p}" fill="${ink}"/>`;
    }
    case "soft": {
      let c = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d(x, y)) c += `<rect x="${x + 0.07}" y="${y + 0.07}" width="0.86" height="0.86" rx="0.28"/>`;
      return `<g fill="${ink}">${c}</g>`;
    }
    case "dots": {
      let c = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d(x, y)) c += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="${f(0.4 + jitter(bytes, x * 7 + y * 13) * 0.08)}"/>`;
      return `<g fill="${ink}">${c}</g>`;
    }
    case "liquid": {
      const r = 0.5;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          if (d(x, y)) {
            const N = d(x, y - 1), S = d(x, y + 1), W = d(x - 1, y), E = d(x + 1, y);
            const tl = !N && !W ? r : 0, tr = !N && !E ? r : 0, br = !S && !E ? r : 0, bl = !S && !W ? r : 0;
            p += `M${x + tl} ${y}H${x + 1 - tr}${tr ? `A${r} ${r} 0 0 1 ${x + 1} ${y + tr}` : ""}V${y + 1 - br}${br ? `A${r} ${r} 0 0 1 ${x + 1 - br} ${y + 1}` : ""}H${x + bl}${bl ? `A${r} ${r} 0 0 1 ${x} ${y + 1 - bl}` : ""}V${y + tl}${tl ? `A${r} ${r} 0 0 1 ${x + tl} ${y}` : ""}Z`;
          } else if (!m.dark(x, y)) {
            // Concave fillets where three dark neighbours meet round a light corner.
            const fr = 0.35;
            if (d(x - 1, y) && d(x, y - 1) && d(x - 1, y - 1)) p += `M${x} ${y}h${fr}A${fr} ${fr} 0 0 0 ${x} ${y + fr}Z`;
            if (d(x + 1, y) && d(x, y - 1) && d(x + 1, y - 1)) p += `M${x + 1} ${y}v${fr}A${fr} ${fr} 0 0 0 ${x + 1 - fr} ${y}Z`;
            if (d(x + 1, y) && d(x, y + 1) && d(x + 1, y + 1)) p += `M${x + 1} ${y + 1}h${-fr}A${fr} ${fr} 0 0 0 ${x + 1} ${y + 1 - fr}Z`;
            if (d(x - 1, y) && d(x, y + 1) && d(x - 1, y + 1)) p += `M${x} ${y + 1}v${-fr}A${fr} ${fr} 0 0 0 ${x + fr} ${y + 1}Z`;
          }
        }
      return `<path d="${p}" fill="${ink}"/>`;
    }
    case "pills": {
      // Horizontal runs become rounded strokes; lone modules become dots.
      let dots = "";
      for (let y = 0; y < n; y++) {
        let x = 0;
        while (x < n) {
          if (!d(x, y)) { x++; continue; }
          let e = x;
          while (d(e + 1, y)) e++;
          if (e === x) dots += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.44"/>`;
          else p += `M${x + 0.5} ${y + 0.5}H${e + 0.5}`;
          x = e + 1;
        }
      }
      return `<path d="${p}" stroke="${ink}" stroke-width="0.88" stroke-linecap="round" fill="none"/><g fill="${ink}">${dots}</g>`;
    }
    case "molecule": {
      // Atoms and bonds: a dot per module, a bridge to each dark neighbour right and below.
      let c = "";
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          if (!d(x, y)) continue;
          c += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.42"/>`;
          if (d(x + 1, y)) p += `M${x + 0.5} ${y + 0.22}h1v0.56h-1z`;
          if (d(x, y + 1)) p += `M${x + 0.22} ${y + 0.5}h0.56v1h-0.56z`;
        }
      return `<g fill="${ink}">${c}<path d="${p}"/></g>`;
    }
    case "engraved": {
      // Three engraved lines per row: hairlines across light modules, swelling to full width over dark ones.
      const hair: string[] = [];
      const thick: string[] = [];
      for (let y = 0; y < n; y++)
        for (let k = 0; k < 3; k++) {
          const yy = y + (k + 0.5) / 3;
          const phase = jitter(bytes, y * 3 + k) * Math.PI * 2;
          const wave = (x: number) => f(yy + Math.sin(x * 0.9 + phase) * 0.035);
          let h = `M0 ${wave(0)}`;
          for (let x = 0.5; x <= n; x += 0.5) h += `L${x} ${wave(x)}`;
          hair.push(h);
          let x = 0;
          while (x < n) {
            if (!d(x, y)) { x++; continue; }
            let e = x;
            while (d(e + 1, y)) e++;
            let t = `M${x} ${wave(x)}`;
            for (let xx = x + 0.5; xx <= e + 1; xx += 0.5) t += `L${xx} ${wave(xx)}`;
            thick.push(t);
            x = e + 1;
          }
        }
      return `<path d="${hair.join("")}" stroke="${ink}" stroke-width="0.04" fill="none" opacity="0.4"/><path d="${thick.join("")}" stroke="${ink}" stroke-width="0.33" fill="none"/>`;
    }
    case "halftone": {
      // Each dark module is four touching dots; light modules carry a speck, like a printed screen.
      let c = "";
      let s = "";
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          if (d(x, y)) for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) c += `<circle cx="${x + dx}" cy="${y + dy}" r="0.33"/>`;
          else if (!inFinder(n, x, y) && (x + y) % 2 === 0) s += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.05"/>`;
        }
      return `<g fill="${ink}">${c}</g><g fill="${ink}" opacity="0.35">${s}</g>`;
    }
  }
}

const FINDER: Record<QrStyle, "square" | "rounded" | "circle"> = {
  classic: "square", tiles: "square", soft: "rounded", dots: "circle", liquid: "rounded", pills: "rounded", molecule: "circle", engraved: "square", halftone: "square",
};

/** A complete SVG; `quiet` is the white margin in modules (4 is the spec, 2 is enough for phones). */
export function qrArt(m: Matrix, style: QrStyle, opts: { ink?: string; paper?: string; quiet?: number; bytes?: Uint8Array; size?: number } = {}): string {
  const ink = opts.ink ?? "#000";
  const q = opts.quiet ?? 2;
  const n = m.size;
  const v = n + 2 * q;
  const sz = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${v} ${v}"${sz} shape-rendering="geometricPrecision">${opts.paper ? `<rect x="${-q}" y="${-q}" width="${v}" height="${v}" fill="${opts.paper}"/>` : ""}${body(m, style, ink, opts.bytes)}${finders(n, FINDER[style], ink)}</svg>`;
}


/** The house style: every code is printed in it. Not a setting (chef's choice). */
export const HOUSE_STYLE: QrStyle = "liquid";
