import { createStore, useStore } from "./store";
import type { QrStyle } from "./ui/qrart";

/**
 * Two colours, always: the one you pick and white. "Ink on paper" puts your colour on white;
 * "inverted" floods the app with your colour and draws everything in white, the codes included
 * (phone cameras read light-on-dark codes; "Plain" shows the classic dark-on-light one for fussy
 * gate scanners).
 */
export interface Theme {
  ink: string;
  inverted: boolean;
  qrStyle: QrStyle;
  onboarded: boolean;
}

export const PAPER = "#ffffff";

export const PALETTE: { name: string; ink: string }[] = [
  { name: "Ink", ink: "#0b0b0b" },
  { name: "Marine", ink: "#1c3f94" },
  { name: "Klein", ink: "#1f2bc4" },
  { name: "Vermilion", ink: "#c0311f" },
  { name: "Forest", ink: "#1e5b3c" },
  { name: "Teal", ink: "#0f5c63" },
  { name: "Aubergine", ink: "#4b2257" },
  { name: "Rust", ink: "#8a3b12" },
];

const KEY = "qrwallet.theme";
const DEFAULT: Theme = { ink: "#0b0b0b", inverted: false, qrStyle: "liquid", onboarded: false };

function load(): Theme {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
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

/** WCAG relative luminance and contrast against white; scanners and eyes both want ≥ 4.5. */
export function contrastOnWhite(hex: string) {
  const c = hex.replace("#", "").match(/../g)!.map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05);
}

/** Darkens a colour until it holds 4.5:1 on white. */
export function legible(hex: string) {
  let [r, g, b] = hex.replace("#", "").match(/../g)!.map((v) => parseInt(v, 16));
  const out = () => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  for (let i = 0; i < 40 && contrastOnWhite(out()) < 4.5; i++) [r, g, b] = [r * 0.92, g * 0.92, b * 0.92];
  return out();
}

export function colours(t: Theme = store.get()) {
  const fg = t.inverted ? PAPER : t.ink;
  const bg = t.inverted ? t.ink : PAPER;
  return { fg, bg, ink: t.ink, paper: PAPER, codeFg: fg, codeBg: bg };
}

export function apply() {
  const { fg, bg, codeFg, codeBg } = colours();
  const root = document.documentElement.style;
  root.setProperty("--fg", fg);
  root.setProperty("--bg", bg);
  root.setProperty("--code-fg", codeFg);
  root.setProperty("--code-bg", codeBg);
  root.setProperty("--ink", store.get().ink);
  root.setProperty("--paper", PAPER);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
  document.documentElement.classList.toggle("inverted", store.get().inverted);
}
apply();
