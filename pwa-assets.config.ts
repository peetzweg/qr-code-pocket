import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset as preset,
} from "@vite-pwa/assets-generator/config";

/** Behind the icon's rounded corners, so the platform's own icon mask never shows a sliver of another colour. */
const ICON_FILL = { background: "#e2412f", fit: "contain" } as const;

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: combinePresetAndAppleSplashScreens(
    {
      ...preset,
      maskable: { ...preset.maskable, padding: 0, resizeOptions: ICON_FILL },
      apple: { ...preset.apple, padding: 0, resizeOptions: ICON_FILL },
    },
    {
      padding: 0.42,
      resizeOptions: { background: "#f2f1ed", fit: "contain" },
      darkResizeOptions: { background: "#0b0b0d", fit: "contain" },
      linkMediaOptions: { log: false, addMediaScreen: true, basePath: "/", xhtml: false },
    },
    ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17", "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16", "iPhone 16e", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 14 Plus", "iPhone 13 mini", 'iPhone SE 4.7"'],
  ),
  images: ["public/favicon.svg"],
});
