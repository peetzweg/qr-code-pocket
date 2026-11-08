import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
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

/** The deployed origin, for canonical and share links, which must be absolute. Unset locally. */
const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "");

/** Fills %SITE_URL% in index.html; without an origin, drops the tags that need one rather than ship broken links. */
function seo(): Plugin {
  return {
    name: "qrwallet-seo",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        (siteUrl ? html : html.replace(/\s*<link rel="canonical"[^>]*>/, "").replace(/\s*<meta property="og:url"[^>]*>/, "")).replaceAll("%SITE_URL%", siteUrl),
    },
    generateBundle() {
      const robots = ["User-agent: *", "Allow: /", ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : [])];
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots.join("\n") + "\n" });
      if (siteUrl)
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url></urlset>\n` });
    },
  };
}

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
    seo(),
    VitePWA({
      // "prompt" so the app decides when to swap in a new version (src/pwa.ts): never under your finger.
      registerType: "prompt",
      pwaAssets: { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true, injectThemeColor: false },
      workbox: {
        // The app, the code reader (wasm) and the PDF worker are precached: scanning works offline from the first launch.
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,ico,wasm,woff2}"],
        globIgnores: ["**/apple-splash-*", "**/og.*", "ocr/**", "pdfjs/**"],
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
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        categories: ["travel", "utilities", "lifestyle"],
        // Shown in Android's and desktop Chrome's richer install dialog.
        screenshots: [{ src: `${base}og.png`, sizes: "1200x630", type: "image/png", form_factor: "wide", label: "QR Code Wallet" }],
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
