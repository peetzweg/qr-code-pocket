import type { Category } from "../categories";

/**
 * Ticket shapes, one per kind, like the die-cut stock each kind is printed on. Drawn as one SVG
 * outline (fill paper, stroke ink) so every curve and notch is a single clean 1px line.
 *
 * - Train, transit: clipped corners, like a JR Edmondson card ticket.
 * - Flight: rounded corners, a boarding pass.
 * - Sight: scalloped top and bottom edges, a paper admission ticket.
 * - Event: scooped corners, an "admit one" stub.
 * - Food: a zigzag top edge, torn off a receipt printer.
 * - Stay: small rounded corners, a key card.
 * - Card: card radius.
 * - Other (Wi-Fi, links): plain and square.
 *
 * Lines (tear, crop frame) are dashed on travel tickets and dotted on the rest.
 */
type Corner = { kind: "square" } | { kind: "round"; r: number } | { kind: "clip"; r: number } | { kind: "scoop"; r: number };
type Edge = "straight" | "scallop" | "zigzag";
export interface Shape {
  corner: Corner;
  top: Edge;
  bottom: Edge;
  /** Half-circle notches at the tear line. */
  notches: boolean;
  line: "dashed" | "dotted";
}

const SHAPES: Record<Category, Shape> = {
  train: { corner: { kind: "clip", r: 13 }, top: "straight", bottom: "straight", notches: true, line: "dashed" },
  transit: { corner: { kind: "clip", r: 13 }, top: "straight", bottom: "straight", notches: true, line: "dashed" },
  flight: { corner: { kind: "round", r: 16 }, top: "straight", bottom: "straight", notches: true, line: "dashed" },
  sight: { corner: { kind: "square" }, top: "scallop", bottom: "scallop", notches: false, line: "dotted" },
  event: { corner: { kind: "scoop", r: 16 }, top: "straight", bottom: "straight", notches: true, line: "dotted" },
  food: { corner: { kind: "square" }, top: "zigzag", bottom: "straight", notches: false, line: "dotted" },
  stay: { corner: { kind: "round", r: 7 }, top: "straight", bottom: "straight", notches: false, line: "dotted" },
  card: { corner: { kind: "round", r: 18 }, top: "straight", bottom: "straight", notches: false, line: "dotted" },
  other: { corner: { kind: "square" }, top: "straight", bottom: "straight", notches: false, line: "dotted" },
};

export const shapeOf = (c: Category): Shape => SHAPES[c] ?? SHAPES.other;

const NOTCH = 10;
const f = (n: number) => +n.toFixed(2);

/** A patterned edge from (ax, ay) to (bx, by), cut inward (the outline runs clockwise). */
function edge(ax: number, ay: number, bx: number, by: number, pattern: Edge): string {
  if (pattern === "straight") return `L${f(bx)} ${f(by)}`;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len, uy = (by - ay) / len;
  // Inward normal of a clockwise outline: the direction rotated right by 90° (screen coordinates).
  const nx = -uy, ny = ux;
  const period = pattern === "scallop" ? 13 : 9;
  const n = Math.max(1, Math.floor(len / period));
  const pad = (len - n * period) / 2;
  const at = (d: number, inset = 0) => `${f(ax + ux * d + nx * inset)} ${f(ay + uy * d + ny * inset)}`;
  let p = `L${at(pad)}`;
  for (let i = 0; i < n; i++) {
    const s = pad + i * period;
    if (pattern === "scallop") {
      // A round bite with a little land either side.
      const r = 4.5;
      const a = s + (period - 2 * r) / 2;
      p += ` L${at(a)} A${r} ${r} 0 0 0 ${at(a + 2 * r)} L${at(s + period)}`;
    } else {
      p += ` L${at(s + period / 2, 4.5)} L${at(s + period)}`;
    }
  }
  return `${p} L${f(bx)} ${f(by)}`;
}

/** One corner: from where the last edge ended to (tx, ty), where the next begins. */
function corner(c: Corner, tx: number, ty: number): string {
  if (c.kind === "square") return "";
  if (c.kind === "clip") return `L${f(tx)} ${f(ty)}`;
  return `A${c.r} ${c.r} 0 0 ${c.kind === "round" ? 1 : 0} ${f(tx)} ${f(ty)}`;
}

/** The outline path for a ticket of size w × h whose tear line sits at tearY. */
export function outline(s: Shape, w: number, h: number, tearY?: number): string {
  const x0 = 0.5, y0 = 0.5, x1 = w - 0.5, y1 = h - 0.5;
  const k = s.corner.kind === "square" ? 0 : s.corner.r;
  const notch = s.notches && tearY !== undefined && tearY > k + NOTCH && tearY < h - k - NOTCH;
  let p = `M${f(x0 + k)} ${f(y0)}`;
  p += " " + edge(x0 + k, y0, x1 - k, y0, s.top);
  p += " " + corner(s.corner, x1, y0 + k);
  if (notch) p += ` L${f(x1)} ${f(tearY! - NOTCH)} A${NOTCH} ${NOTCH} 0 0 0 ${f(x1)} ${f(tearY! + NOTCH)}`;
  p += ` L${f(x1)} ${f(y1 - k)}`;
  p += " " + corner(s.corner, x1 - k, y1);
  p += " " + edge(x1 - k, y1, x0 + k, y1, s.bottom);
  p += " " + corner(s.corner, x0, y1 - k);
  if (notch) p += ` L${f(x0)} ${f(tearY! + NOTCH)} A${NOTCH} ${NOTCH} 0 0 0 ${f(x0)} ${f(tearY! - NOTCH)}`;
  p += ` L${f(x0)} ${f(y0 + k)}`;
  p += " " + corner(s.corner, x0 + k, y0);
  return p.replace(/\s+/g, " ") + " Z";
}
