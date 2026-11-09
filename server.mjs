// Serves the built app and a tiny share inbox. No dependencies.
//
//   PORT=5182 node server.mjs
//
// The inbox exists because iOS doesn't let Home Screen web apps receive shares. An iOS Shortcut in the
// share sheet POSTs the screenshot or PDF here; the app takes it the next time it's opened. Android's
// share target posts multipart to /api/share. Meant to sit behind `tailscale serve` (tailnet only).
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";

const root = new URL("./dist/", import.meta.url).pathname;
const inbox = new URL("./inbox/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 5182);
const host = process.env.HOST ?? "127.0.0.1";
mkdirSync(inbox, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon", ".wasm": "application/wasm", ".gz": "application/gzip",
  ".bcmap": "application/octet-stream", ".pfb": "application/octet-stream", ".ttf": "font/ttf", ".icc": "application/vnd.iccprofile",
  ".txt": "text/plain", ".shortcut": "application/octet-stream",
};
const MAX = 40 * 1024 * 1024;

const extFor = (type) => ({ "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/heic": ".heic", "image/webp": ".webp", "image/gif": ".gif" })[type] ?? "";

function store(buf, type, name) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  type = (type || "application/octet-stream").split(";")[0].trim();
  // Shortcuts sometimes sends a generic type; trust the bytes.
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) type = "application/pdf";
  else if (buf[0] === 0x89 && buf[1] === 0x50) type = "image/png";
  else if (buf[0] === 0xff && buf[1] === 0xd8) type = "image/jpeg";
  name = (name || `shared-${id}${extFor(type)}`).replace(/[\/\\]/g, "_").slice(0, 120);
  writeFileSync(join(inbox, id), buf);
  writeFileSync(join(inbox, `${id}.json`), JSON.stringify({ id, name, type, at: Date.now() }));
  return id;
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX) throw new Error("too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

const json = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};


// ---------- Brand lookup for loyalty cards: name, colour and best icon of a website ----------
// The app can't read other sites (CORS), so it asks here. Only public http(s) addresses are fetched.
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 QRCodePocket";
const PRIVATE = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1?$|f[cd]|fe80|::ffff:(10|127|192\.168)\.)/i;

async function publicUrl(u) {
  const url = new URL(u);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("not a web address");
  const { address } = await lookup(url.hostname);
  if (PRIVATE.test(address)) throw new Error("not a public address");
  return url;
}

async function grab(u, max, accept = "*/*") {
  let url = await publicUrl(u);
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": UA, accept, "accept-language": "en,ja;q=0.8" }, signal: AbortSignal.timeout(8000) });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      url = await publicUrl(new URL(r.headers.get("location"), url));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} from ${url.hostname}`);
    const chunks = [];
    let size = 0;
    for await (const c of r.body) {
      size += c.length;
      if (size > max) break;
      chunks.push(c);
    }
    return { url, type: (r.headers.get("content-type") ?? "").split(";")[0].trim(), buf: Buffer.concat(chunks) };
  }
  throw new Error("too many redirects");
}

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => [m[1].toLowerCase(), m[3] ?? m[4] ?? m[5] ?? ""]));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).trim();
const sizeOf = (sizes) => Math.max(0, ...String(sizes ?? "").split(/\s+/).map((x) => (x === "any" ? 256 : parseInt(x, 10) || 0)));

function sniff(buf, type) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return "image/x-icon";
  if (buf.subarray(0, 4).toString() === "RIFF") return "image/webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (/<svg[\s>]/i.test(buf.subarray(0, 2000).toString())) return "image/svg+xml";
  return type.startsWith("image/") ? type : undefined;
}

/** An icon's width in pixels, from its header (the largest image in an .ico). */
function pixels(buf, type) {
  if (type === "image/svg+xml") return 512;
  if (type === "image/png") return buf.readUInt32BE(16);
  if (type === "image/x-icon") {
    let best = 0;
    for (let i = 0, n = buf.readUInt16LE(4); i < n && 6 + i * 16 < buf.length; i++) best = Math.max(best, buf[6 + i * 16] || 256);
    return best;
  }
  return 96;
}

async function brand(site) {
  const start = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  // Some sites turn non-browsers away; then only the well-known icon paths and a favicon service are tried.
  const page = await grab(start, 1_500_000, "text/html").catch(async () => ({ url: await publicUrl(start), buf: Buffer.alloc(0), blocked: true }));
  const html = page.buf.toString("utf8");
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || 300_000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (...keys) => metas.find((m) => keys.includes((m.property ?? m.name ?? "").toLowerCase()) && m.content)?.content;
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  let name = meta("og:site_name", "application-name", "apple-mobile-web-app-title") ?? title?.split(/\s[|–—·:-]\s/)[0];
  const color = meta("theme-color");

  // Icon candidates, best first: big apple-touch-icons and manifest icons, then <link rel=icon>, then /favicon.ico.
  const icons = [];
  const base = page.url;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel ?? "").toLowerCase();
    if (!a.href) continue;
    if (rel.includes("apple-touch-icon")) icons.push({ href: new URL(decode(a.href), base), score: 2000 + (sizeOf(a.sizes) || 180) });
    else if (/(^|\s)icon(\s|$)/.test(rel)) icons.push({ href: new URL(decode(a.href), base), score: 1000 + (a.type === "image/svg+xml" || /\.svg($|\?)/.test(a.href) ? 256 : sizeOf(a.sizes) || 32) });
    else if (rel === "manifest") {
      try {
        const man = JSON.parse((await grab(new URL(decode(a.href), base), 300_000, "application/json")).buf.toString("utf8"));
        name ??= man.short_name ?? man.name;
        for (const i of man.icons ?? []) if (!/monochrome/.test(i.purpose ?? "")) icons.push({ href: new URL(i.src, new URL(decode(a.href), base)), score: 1500 + Math.min(512, sizeOf(i.sizes)) });
      } catch {}
    }
  }
  icons.push(
    { href: new URL("/apple-touch-icon.png", base), score: 900 },
    { href: new URL("/favicon.ico", base), score: 100 },
    { href: new URL(`https://www.google.com/s2/favicons?domain=${base.hostname}&sz=256`), score: 50 },
  );
  icons.sort((a, b) => b.score - a.score);
  // Take the first that's big enough to print large; otherwise the biggest found.
  let icon;
  for (const c of icons) {
    try {
      const r = await grab(c.href, 800_000, "image/*");
      const type = sniff(r.buf, r.type);
      if (!type || r.buf.length < 100) continue;
      const px = pixels(r.buf, type);
      if (!icon || px > icon.px) icon = { type, data: r.buf.toString("base64"), px };
      if (px >= 120) break;
    } catch {}
  }
  if (!name && page.blocked) name = base.hostname.replace(/^www\./, "").split(".")[0].replace(/^./, (c) => c.toUpperCase());
  return { site: page.url.hostname.replace(/^www\./, ""), name: name ? decode(name).slice(0, 60) : undefined, color, icon };
}

async function api(req, res, path) {
  if (path === "/api/brand" && req.method === "GET") {
    const site = new URL(req.url, "http://local").searchParams.get("site")?.trim();
    if (!site) return json(res, 400, { error: "site missing" });
    try {
      return json(res, 200, await brand(site));
    } catch (err) {
      return json(res, 502, { error: String(err?.message ?? err) });
    }
  }
  if (path === "/api/inbox" && req.method === "GET") {
    const items = readdirSync(inbox)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(inbox, f), "utf8")))
      .sort((a, b) => a.at - b.at);
    return json(res, 200, items);
  }
  if (path === "/api/inbox" && (req.method === "POST" || req.method === "PUT")) {
    const buf = await body(req);
    if (!buf.length) return json(res, 400, { error: "empty body" });
    const name = req.headers["x-filename"] ? decodeURIComponent(String(req.headers["x-filename"])) : undefined;
    return json(res, 201, { id: store(buf, req.headers["content-type"], name) });
  }
  if (path === "/api/share" && req.method === "POST") {
    // Android share target: multipart form with files (and maybe a title/text/url).
    const form = await new Request("http://local/", { method: "POST", headers: req.headers, body: Readable.toWeb(req), duplex: "half" }).formData();
    for (const value of form.getAll("files")) {
      if (typeof value === "string") continue;
      store(Buffer.from(await value.arrayBuffer()), value.type, value.name);
    }
    res.writeHead(303, { location: "/?inbox=1" });
    return res.end();
  }
  const m = path.match(/^\/api\/inbox\/([\w-]+)$/);
  if (m && existsSync(join(inbox, `${m[1]}.json`))) {
    const meta = JSON.parse(readFileSync(join(inbox, `${m[1]}.json`), "utf8"));
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": meta.type, "cache-control": "no-store" });
      return createReadStream(join(inbox, m[1])).pipe(res);
    }
    if (req.method === "DELETE") {
      unlinkSync(join(inbox, m[1]));
      unlinkSync(join(inbox, `${m[1]}.json`));
      return json(res, 200, { ok: true });
    }
  }
  return json(res, 404, { error: "not found" });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://local");
    const path = decodeURIComponent(url.pathname);
    if (path.startsWith("/api/")) return await api(req, res, path);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) return json(res, 403, { error: "forbidden" });
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
    const ext = extname(file);
    const revalidate = ext === ".html" || file.endsWith("sw.js") || ext === ".webmanifest" || file.includes("workbox-");
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": revalidate ? "no-cache" : path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    });
    createReadStream(file).pipe(res);
  } catch (err) {
    json(res, 500, { error: String(err?.message ?? err) });
  }
}).listen(port, host, () => console.log(`kippu on http://${host}:${port}`));
