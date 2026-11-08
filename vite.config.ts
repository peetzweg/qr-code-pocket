import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

/** Where the app is served from: "/" on its own origin (Tailscale), "/kippu/" on GitHub Pages. */
const base = process.env.BASE_PATH ?? "/";

/** Short commit of the build, shown in Settings so you can tell which version a phone is running. */
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
})();

const DAY = 24 * 60 * 60;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit),
    __BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  // Reachable over Tailscale (tailscale serve proxies the tailnet's ts.net name to the server).
  server: { allowedHosts: [".ts.net"] },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
  plugins: [
    react(),
    VitePWA({
      // "prompt" so the app decides when to swap in a new version (src/pwa.ts): never under your finger.
      registerType: "prompt",
      pwaAssets: { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true, injectThemeColor: false },
      workbox: {
        // The app, the code reader (wasm) and the PDF worker are precached: scanning works offline from the first launch.
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,ico,wasm,woff2}"],
        globIgnores: ["**/apple-splash-*", "ocr/**", "pdfjs/**"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /\.shortcut$/],
        runtimeCaching: [
          {
            // The OCR engine and models (~9 MB) and pdf.js' CMaps: fetched the first time they're needed, then kept.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/(ocr|pdfjs)\//.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "kippu-engines", expiration: { maxEntries: 400, maxAgeSeconds: 365 * DAY }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
      manifest: {
        id: base,
        name: "QR Code Wallet",
        short_name: "QR Wallet",
        description: "A wallet for the QR codes you collect while travelling: tickets, entries, reservations. Stamp them when used.",
        lang: "en",
        theme_color: "#f2f1ed",
        background_color: "#f2f1ed",
        display: "standalone",
        orientation: "portrait",
        categories: ["travel", "utilities", "lifestyle"],
        // Android: Kippu appears in the share sheet. The server stores the files in its inbox (server.mjs).
        share_target: {
          action: `${base}api/share`,
          method: "POST",
          enctype: "multipart/form-data",
          params: { title: "title", text: "text", url: "url", files: [{ name: "files", accept: ["image/*", "application/pdf", ".pdf"] }] },
        },
      },
    }),
  ],
});
