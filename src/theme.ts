import { createStore, useStore } from "./store";

/**
 * Two colours, always: one ink and one paper.
 *
 * - Day and Night each have their own look: a colour and a fill. By day the paper is white, by night
 *   black; "Auto" follows the phone. So "Ai as lines by day, Shu flooding the page at night" works.
 * - Fill, Line or Flood: Line prints the ink as lines and type on the paper; Flood floods the page
 *   with the ink and prints everything, the codes included, in the paper colour.
 *
 * Every colour has a day shade (dark enough on white) and a night shade (light enough on black), so
 * every combination stays readable and scannable. "Plain" always shows the classic dark-on-white code
 * for fussy gate scanners.
 */
export type Appearance = "day" | "night" | "auto";
export type Mode = "day" | "night";
export type Fill = "line" | "flood";

/** One look: a colour and how it's printed. Day and night each have their own. */
export interface Look {
  /** A palette id, or "own" for `custom`. */
  colour: string;
  custom?: string;
  fill: Fill;
}

export interface Theme {
  day: Look;
  night: Look;
  appearance: Appearance;
  /** Light the code up when a ticket opens (HDR white behind it). */
  bright: boolean;
  onboarded: boolean;
}

export interface Swatch {
  id: string;
  kanji: string;
  name: string;
  /** The traditional colour; day and night shades are derived from it. */
  base: string;
  day: string;
  night: string;
}

/**
 * Omakase: traditional Japanese colours (values after nipponcolors.com). Each is darkened (day) or
 * lightened (night) in OKLCH, hue and chroma kept, only as far as it must to hold 5:1 on white or 7:1
 * on black, so it stays itself.
 */
const BASES: [string, string, string, string][] = [
  ["sumi", "墨", "Sumi", "#1c1c1c"],
  ["kon", "紺", "Kon", "#223a70"],
  ["ai", "藍", "Ai", "#165e83"],
  ["ruri", "瑠璃", "Ruri", "#1e50a2"],
  ["shu", "朱", "Shu", "#eb6101"],
  ["beni", "紅", "Beni", "#d7003a"],
  ["matcha", "抹茶", "Matcha", "#8a9a3b"],
  ["asagi", "浅葱", "Asagi", "#00a3af"],
  ["fuji", "藤", "Fuji", "#8f82bc"],
  ["kuchiba", "朽葉", "Kuchiba", "#917347"],
];

export const WHITE = "#ffffff";
export const BLACK = "#0b0b0b";

const KEY = "qrwallet.theme";
const DEFAULT: Theme = {
  day: { colour: "sumi", fill: "line" },
  night: { colour: "sumi", fill: "line" },
  appearance: "auto",
  bright: true,
  onboarded: false,
};

function load(): Theme {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    // v1: { ink, inverted }.
    if (raw.ink && !raw.colour && !raw.day) {
      const id = raw.ink === "#1c3f94" ? "ai" : raw.ink === "#0b0b0b" ? "sumi" : "own";
      raw.colour = id;
      if (id === "own") raw.custom = raw.ink;
      raw.fill = raw.inverted ? "flood" : "line";
      raw.appearance = "day";
    }
    // v2: one { colour, custom, fill } for both.
    if (raw.colour && !raw.day) {
      const look: Look = { colour: raw.colour, custom: raw.custom, fill: raw.fill ?? "line" };
      raw.day = { ...look };
      raw.night = { ...look };
    }
    for (const k of ["ink", "inverted", "colour", "custom", "fill"]) delete raw[k];
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

export function setLook(mode: Mode, patch: Partial<Look>) {
  setTheme({ [mode]: { ...store.get()[mode], ...patch } } as Partial<Theme>);
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
// OKLCH: change only lightness (keeping hue and chroma) so a colour stays itself in both shades.
const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function oklchToRgb(L: number, C: number, h: number): number[] {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** Nearest in-gamut colour at this lightness and hue: chroma comes down until it fits. */
function oklchToHex(L: number, C: number, h: number) {
  for (let c = C; c >= 0; c -= 0.005) {
    const rgb = oklchToRgb(L, c, h);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return rgbToHex(rgb.map((v) => toGamma(Math.max(0, Math.min(1, v))) * 255));
  }
  return rgbToHex(oklchToRgb(L, 0, h).map((v) => toGamma(Math.max(0, Math.min(1, v))) * 255));
}
/** Moves only the lightness, darker or lighter, until the colour holds `ratio` against `against`. */
function holdContrast(hex: string, against: string, dir: 1 | -1, ratio: number) {
  if (contrast(hex, against) >= ratio) return hex;
  const [L0, C, h] = hexToOklch(hex);
  for (let L = L0; L >= 0 && L <= 1; L += dir * 0.005) {
    const c = oklchToHex(L, C, h);
    if (contrast(c, against) >= ratio) return c;
  }
  return dir > 0 ? WHITE : BLACK;
}

/** Any colour, made to work by day and by night. */
export function makeSwatch(id: string, kanji: string, name: string, base: string, nightOverride?: string): Swatch {
  return { id, kanji, name, base, day: holdContrast(base, WHITE, -1, 5), night: nightOverride ?? holdContrast(base, BLACK, 1, 7) };
}

/** Sumi's night shade is the paper it's ground on (胡粉, gofun white), not a grey. */
const NIGHT: Record<string, string> = { sumi: "#efece5" };
export const PALETTE: Swatch[] = BASES.map(([id, kanji, name, base]) => makeSwatch(id, kanji, name, base, NIGHT[id]));

export function swatchOf(look: Look): Swatch {
  if (look.colour === "own" && look.custom) return makeSwatch("own", "", "Own", look.custom);
  return PALETTE.find((p) => p.id === look.colour) ?? PALETTE[0];
}

const night = matchMedia("(prefers-color-scheme: dark)");
export const modeOf = (t: Theme = store.get()): Mode => (t.appearance === "night" || (t.appearance === "auto" && night.matches) ? "night" : "day");
export const isNight = (t: Theme = store.get()) => modeOf(t) === "night";

/** The two colours for a look in a mode; the current one by default. */
export function coloursFor(look: Look, mode: Mode) {
  const sw = swatchOf(look);
  const paper = mode === "night" ? BLACK : WHITE;
  const ink = mode === "night" ? sw.night : sw.day;
  const fg = look.fill === "flood" ? paper : ink;
  const bg = look.fill === "flood" ? ink : paper;
  return { fg, bg, ink, paper, codeFg: fg, codeBg: bg, plainInk: swatchOf(look).day, darkGround: luminance(bg) < 0.2 };
}

export function colours(t: Theme = store.get()) {
  const mode = modeOf(t);
  return coloursFor(t[mode], mode);
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
