// Serves the built app and a tiny share inbox. No dependencies.
//
//   PORT=5182 node server.mjs
//
// The inbox exists because iOS doesn't let Home Screen web apps receive shares. An iOS Shortcut in the
// share sheet POSTs the screenshot or PDF here; the app takes it the next time it's opened. Android's
// share target posts multipart to /api/share. Meant to sit behind `tailscale serve` (tailnet only).
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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

async function api(req, res, path) {
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
