import { categoryInfo, isCard, isJourney } from "../categories";
import { isLinear } from "../scan/zxing";
import { readPayload, type PayloadInfo } from "../scan/payload";
import type { Pass } from "../store/db";
import { dayLabel, parseIso, todayIso } from "./format";

/** The words printed on a ticket: issuer, kind, when, the line under the title. */
export function ticketText(p: Pick<Pass, "title" | "category" | "date" | "time" | "from" | "to" | "seat" | "place" | "notes" | "codes" | "site">) {
  const code = p.codes[0];
  const info: PayloadInfo | undefined = code ? readPayload(code.text, !!code.bytes) : undefined;
  const cat = categoryInfo(p.category);
  const issuer = info?.issuer ?? cat.label;
  const route = isJourney(p.category) && p.from && p.to && !p.title.includes(p.from) ? `${p.from} → ${p.to}` : undefined;
  const sub = [route, p.seat, p.place].filter(Boolean).join(" · ") || undefined;
  const day = p.date ? dayLabel(p.date) : undefined;
  if (isCard(p.category)) {
    // A card: the member number under the name (what a cashier types when the scanner won't read).
    const number = code && isLinear(code.format) && code.text.length <= 24 ? code.text.replace(/(\d{4})(?=\d)/g, "$1 ") : undefined;
    return { info, cat, issuer: cat.label, sub: [number, p.place].filter(Boolean).join(" · ") || undefined, day: p.site };
  }
  return { info, cat, issuer, sub, day };
}

export function countdown(p: Pick<Pass, "date" | "time">, now = Date.now()) {
  if (!p.date) return;
  const [h, m] = (p.time ?? "00:00").split(":").map(Number);
  const at = parseIso(p.date);
  at.setHours(h, m);
  const mins = Math.round((at.getTime() - now) / 60000);
  if (!p.time) return p.date === todayIso() ? "today" : mins > 0 ? `in ${Math.ceil(mins / 1440)} days` : undefined;
  if (mins < -30) return "earlier";
  if (mins < 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  if (mins < 24 * 60) return `in ${Math.floor(mins / 60)} h ${mins % 60} min`;
  const days = Math.round(mins / 1440);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
