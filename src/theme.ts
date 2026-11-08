import { createStore, useStore } from "./store";
import type { QrStyle } from "./ui/qrart";

/**
 * Two colours, always: one ink and one paper.
 *
 * - Appearance, Day or Night: the paper is white or black ("Auto" follows the phone).
 * - Fill, Line or Flood: Line prints the ink as lines and type on the paper; Flood floods the page
 *   with the ink and prints everything, the codes included, in the paper colour.
 *
 * Every colour has a day shade (dark enough on white) and a night shade (light enough on black), so
 * all four combinations stay readable and scannable. "Plain" always shows the classic dark-on-white
 * code for fussy gate scanners.
 */
export type Appearance = "day" | "night" | "auto";
export type Fill = "line" | "flood";

export interface Theme {
  /** A palette id, or "own" for `custom`. */
  colour: string;
  custom?: string;
  appearance: Appearance;
  fill: Fill;
  qrStyle: QrStyle;
  onboarded: boolean;
}

export interface Swatch {
  id: string;
  kanji: string;
  name: string;
  day: string;
  night: string;
}

/** Omakase: the colours we picked. All hold at least 6:1 against their paper. */
export const PALETTE: Swatch[] = [
  { id: "sumi", kanji: "墨", name: "Sumi", day: "#111111", night: "#f0eee9" },
  { id: "kon", kanji: "紺", name: "Kon", day: "#1c2f6e", night: "#a9b9f0" },
  { id: "ai", kanji: "藍", name: "Ai", day: "#1c3f94", night: "#8fb0ff" },
  { id: "ruri", kanji: "瑠璃", name: "Ruri", day: "#1f2bc4", night: "#9aa2ff" },
  { id: "shu", kanji: "朱", name: "Shu", day: "#b8321d", night: "#ff8f75" },
  { id: "beni", kanji: "紅", name: "Beni", day: "#a3123a", night: "#ff8aa5" },
  { id: "matcha", kanji: "抹茶", name: "Matcha", day: "#3b5d1e", night: "#b9d98f" },
  { id: "asagi", kanji: "浅葱", name: "Asagi", day: "#0f5c63", night: "#86d9d9" },
  { id: "fuji", kanji: "藤", name: "Fuji", day: "#5b3d8f", night: "#c9b1f2" },
  { id: "kuchiba", kanji: "朽葉", name: "Kuchiba", day: "#7a4a12", night: "#e8b670" },
];

export const WHITE = "#ffffff";
export const BLACK = "#0b0b0b";

const KEY = "qrwallet.theme";
const DEFAULT: Theme = { colour: "sumi", appearance: "auto", fill: "line", qrStyle: "liquid", onboarded: false };

function load(): Theme {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    // Before Day/Night there was { ink, inverted }.
    if (raw.ink && !raw.colour) {
      const hit = PALETTE.find((p) => p.day.toLowerCase() === String(raw.ink).toLowerCase());
      raw.colour = hit?.id ?? (raw.ink === "#1c3f94" ? "ai" : raw.ink === "#0b0b0b" ? "sumi" : "own");
      if (raw.colour === "own") raw.custom = raw.ink;
      raw.fill = raw.inverted ? "flood" : "line";
      raw.appearance = "day";
      delete raw.ink;
      delete raw.inverted;
    }
    return { ...DEFAULT, ...raw };
  } catch {
    return DEFAULT;
  }
}

const store = createStore<Theme>(load());
export const useTheme = <S,>(sel: (t: Theme) => S) => useStore(store, sel);
export const getTheme = () => store.get();

export function setTheme(patch: Partial<Theme>) {
  store.set(patch);
  localStorage.setItem(KEY, JSON.stringify(store.get()));
  apply();
}

// ---------- colour maths ----------

const hexToRgb = (h: string) => h.replace("#", "").match(/../g)!.map((v) => parseInt(v, 16));
const rgbToHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
function luminance(hex: string) {
  const c = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Mixes a colour toward `target` until it holds `ratio` against `against`. */
function holdContrast(hex: string, against: string, target: string, ratio = 6) {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  for (let t = 0; t <= 1; t += 0.02) {
    const c = rgbToHex(from.map((v, i) => v + (to[i] - v) * t));
    if (contrast(c, against) >= ratio) return c;
  }
  return target;
}

/** A colour of your own, made to work by day and by night. */
export function ownSwatch(hex: string): Swatch {
  return { id: "own", kanji: "", name: "Own", day: holdContrast(hex, WHITE, BLACK), night: holdContrast(hex, BLACK, WHITE) };
}

export function swatchOf(t: Theme = store.get()): Swatch {
  if (t.colour === "own" && t.custom) return ownSwatch(t.custom);
  return PALETTE.find((p) => p.id === t.colour) ?? PALETTE[0];
}

const night = matchMedia("(prefers-color-scheme: dark)");
export const isNight = (t: Theme = store.get()) => t.appearance === "night" || (t.appearance === "auto" && night.matches);

export function colours(t: Theme = store.get()) {
  const sw = swatchOf(t);
  const dark = isNight(t);
  const paper = dark ? BLACK : WHITE;
  const ink = dark ? sw.night : sw.day;
  const fg = t.fill === "flood" ? paper : ink;
  const bg = t.fill === "flood" ? ink : paper;
  return { fg, bg, ink, paper, codeFg: fg, codeBg: bg, plainInk: sw.day, darkGround: luminance(bg) < 0.2 };
}

export function apply() {
  const { fg, bg, ink, paper, codeFg, codeBg, plainInk, darkGround } = colours();
  const root = document.documentElement;
  const s = root.style;
  s.setProperty("--fg", fg);
  s.setProperty("--bg", bg);
  s.setProperty("--ink", ink);
  s.setProperty("--paper", paper);
  s.setProperty("--code-fg", codeFg);
  s.setProperty("--code-bg", codeBg);
  s.setProperty("--plain-ink", plainInk);
  root.classList.toggle("dark-ground", darkGround);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}
night.addEventListener("change", () => {
  if (store.get().appearance === "auto") {
    store.set({});
    apply();
  }
});
apply();
