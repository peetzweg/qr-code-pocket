const pad = (n: number) => String(n).padStart(2, "0");
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const DAY = 864e5;

/** "Today", "Tomorrow", "Wed 12 Nov", "Yesterday", or with the year once it isn't this one. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = parseIso(iso);
  const diff = Math.round((d.getTime() - parseIso(todayIso(now)).getTime()) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-GB", opts);
}

export const longDate = (iso: string) =>
  parseIso(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const stampDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

export const monthLabel = (iso: string) => parseIso(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export const isPast = (iso: string, now = new Date()) => iso < todayIso(now);

/** The day a pass belongs to in History: its own date if it has one, else the day it was used. */
export const historyDay = (p: { date?: string; usedAt?: number; createdAt: number }) => p.date ?? todayIso(new Date(p.usedAt ?? p.createdAt));

export const prettyFormat = (f: string) =>
  f === "QRCode" ? "QR code" : f === "PDF417" ? "PDF417" : f === "Aztec" ? "Aztec code" : f === "DataMatrix" ? "Data Matrix" : f.replace(/(Code)$/, " code");
