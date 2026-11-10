import type { Category } from "../categories";

/**
 * Reads what a ticket is from the text around its code (PDF text or OCR) and the code itself. Plain
 * heuristics tuned to Japanese travel tickets: Shinkansen reservations, museum and attraction entries,
 * restaurant bookings, events. Everything it finds is offered as a tap-to-fill suggestion, never forced.
 */
export interface Suggestions {
  category?: Category;
  titles: string[];
  dates: string[];
  times: string[];
  from?: string;
  to?: string;
  seat?: string;
  train?: string;
  place?: string;
  /** What the code's own payload says, when it says anything (see payload.ts). */
  payload?: import("./payload").PayloadInfo;
}

const KEYWORDS: Record<Exclude<Category, "other">, (string | RegExp)[]> = {
  train: ["新幹線", "shinkansen", "号車", "乗車券", "特急券", "指定席", "自由席", "グリーン車", "smart ex", "smartex", "スマートex", "えきねっと", "e5489", "jr東", "jr西", "jr東海", "jr九州", "ekinet", /\bjr\b/, /(のぞみ|ひかり|こだま|みずほ|はやぶさ|やまびこ|かがやき|はくたか|こまち|つばさ)\s*\d+\s*号/, /\b(nozomi|hikari|kodama|mizuho|hayabusa|yamabiko|kagayaki|hakutaka|komachi|tsubasa)\b/, "train", "platform", "番線"],
  flight: ["boarding", "搭乗", "flight", "gate", "ゲート", "便名", "航空", "airline", "airport", "空港", /\b(ana|jal|peach|jetstar|zipair)\b/],
  transit: ["バス", "bus", "ferry", "フェリー", "地下鉄", "metro", "subway", "monorail", "モノレール", "ropeway", "ロープウェイ", "ケーブルカー", "cable car", "高速バス", "乗船"],
  sight: ["museum", "美術館", "博物館", "入館", "入場", "admission", "entry", "entrance", "teamlab", "チームラボ", "ジブリ", "ghibli", "寺", "神社", "shrine", "temple", "castle", "城", "tower", "タワー", "展望", "observatory", "gallery", "ギャラリー", "exhibition", "展覧会", "aquarium", "水族館", "庭園", "garden", "zoo", "動物園", "pass", "パス"],
  food: ["restaurant", "レストラン", "lunch", "ランチ", "dinner", "ディナー", "takeout", "テイクアウト", "take away", "注文", "order", "cafe", "カフェ", "ramen", "ラーメン", "sushi", "寿司", "鮨", "tablecheck", "tabelog", "食べログ", "omakase", "おまかせ", "コース", "course", "席のみ", "居酒屋", "izakaya", "焼肉", "yakiniku", "menu", "メニュー", "番号札", "整理券"],
  event: ["concert", "ライブ", "公演", "開演", "開場", "festival", "フェス", "祭", "match", "試合", "theater", "theatre", "劇場", "show", "ショー", "stadium", "スタジアム", "ドーム", "arena", "アリーナ", "eplus", "イープラス", "チケットぴあ", "ローチケ"],
  card: ["member", "membership", "loyalty", "rewards", "points", "point card", "ポイント", "会員", "メンバーズ", "カード番号", "card no", "card number", "club card", "bonus card", "kundenkarte", "payback"],
  wifi: ["wi-fi", "wifi", "wlan", "ssid", "無線lan", "network name", "ネットワーク名"],
  stay: ["hotel", "ホテル", "旅館", "ryokan", "check-in", "check in", "チェックイン", "宿泊", "airbnb", "booking.com", "hostel", "ホステル", "guest house", "ゲストハウス", "部屋", "room"],
};

const DOMAIN_HINTS: [RegExp, Category][] = [
  [/smart-ex|jr-central|jreast|jr-odekake|e5489|eki-net|jrkyushu|westjr/i, "train"],
  [/tablecheck|tabelog|omakase|pocket-concierge|autoreserve|toreta|ebica/i, "food"],
  [/ana\.co\.jp|jal\.co|flypeach|jetstar|zipair/i, "flight"],
  [/teamlab|ghibli-museum|museum|tickets\.|klook|kkday|veltra|getyourguide/i, "sight"],
  [/eplus|pia\.jp|l-tike|ticketmaster/i, "event"],
];

/** Shinkansen names, for "Nozomi 23" titles. */
const TRAINS: Record<string, string> = {
  のぞみ: "Nozomi", ひかり: "Hikari", こだま: "Kodama", みずほ: "Mizuho", さくら: "Sakura", つばめ: "Tsubame",
  はやぶさ: "Hayabusa", はやて: "Hayate", やまびこ: "Yamabiko", なすの: "Nasuno", こまち: "Komachi", つばさ: "Tsubasa",
  とき: "Toki", たにがわ: "Tanigawa", かがやき: "Kagayaki", はくたか: "Hakutaka", あさま: "Asama", つるぎ: "Tsurugi", かもめ: "Kamome",
};

/** Stations a traveller is likely to see, so cards can say "Tokyo → Kyoto". Unknown ones stay as written. */
const STATIONS: Record<string, string> = {
  東京: "Tokyo", 品川: "Shinagawa", 新横浜: "Shin-Yokohama", 小田原: "Odawara", 熱海: "Atami", 三島: "Mishima", 静岡: "Shizuoka",
  浜松: "Hamamatsu", 名古屋: "Nagoya", 岐阜羽島: "Gifu-Hashima", 米原: "Maibara", 京都: "Kyoto", 新大阪: "Shin-Osaka", 新神戸: "Shin-Kobe",
  姫路: "Himeji", 岡山: "Okayama", 福山: "Fukuyama", 広島: "Hiroshima", 新山口: "Shin-Yamaguchi", 小倉: "Kokura", 博多: "Hakata",
  熊本: "Kumamoto", 鹿児島中央: "Kagoshima-Chuo", 長崎: "Nagasaki", 上野: "Ueno", 大宮: "Omiya", 宇都宮: "Utsunomiya", 仙台: "Sendai",
  盛岡: "Morioka", 新青森: "Shin-Aomori", 新函館北斗: "Shin-Hakodate-Hokuto", 秋田: "Akita", 山形: "Yamagata", 新潟: "Niigata",
  高崎: "Takasaki", 軽井沢: "Karuizawa", 長野: "Nagano", 富山: "Toyama", 金沢: "Kanazawa", 福井: "Fukui", 敦賀: "Tsuruga",
  大阪: "Osaka", 新宿: "Shinjuku", 渋谷: "Shibuya", 池袋: "Ikebukuro", 奈良: "Nara", 神戸: "Kobe", 横浜: "Yokohama", 成田空港: "Narita Airport",
  関西空港: "Kansai Airport", 羽田空港: "Haneda Airport", 札幌: "Sapporo", 函館: "Hakodate", 日光: "Nikko", 箱根: "Hakone", 伊勢: "Ise",
};
export const stationName = (s: string) => STATIONS[s.replace(/駅$/, "")] ?? s.replace(/駅$/, "");

const pad = (n: number | string) => String(n).padStart(2, "0");

function isoDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** A date without a year is this year's, unless that was more than two months ago (then next year's). */
function guessYear(m: number, d: number, now: Date) {
  const y = now.getFullYear();
  const candidate = new Date(y, m - 1, d);
  return candidate.getTime() < now.getTime() - 60 * 864e5 ? y + 1 : y;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function findDates(text: string, now = new Date()): string[] {
  const found: { iso: string; at: number }[] = [];
  const add = (iso: string | undefined, at: number) => iso && found.push({ iso, at });
  const t = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // 令和8年 = 2026 (Reiwa year + 2018).
  for (const m of t.matchAll(/令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) add(isoDate(2018 + +m[1], +m[2], +m[3]), m.index!);
  for (const m of t.matchAll(/(20\d{2})\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})\s*日?/g)) add(isoDate(+m[1], +m[2], +m[3]), m.index!);
  for (const m of t.matchAll(/(?<![\d/年])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) add(isoDate(guessYear(+m[1], +m[2], now), +m[1], +m[2]), m.index!);
  for (const m of t.matchAll(/(?<![\d/.])(\d{1,2})\/(\d{1,2})(?:\s*[(（]\s*[月火水木金土日])/g)) add(isoDate(guessYear(+m[1], +m[2], now), +m[1], +m[2]), m.index!);
  const mon = MONTHS.join("|");
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(${mon})[a-z]*\\.?,?\\s*(20\\d{2})?`, "gi")))
    add(isoDate(m[3] ? +m[3] : guessYear(MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1, +m[1], now), MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1, +m[1]), m.index!);
  for (const m of t.matchAll(new RegExp(`\\b(${mon})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(20\\d{2})?`, "gi"))) {
    const month = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1;
    add(isoDate(m[3] ? +m[3] : guessYear(month, +m[2], now), month, +m[2]), m.index!);
  }
  // Prefer dates labelled as the day of use; then upcoming ones, soonest first; then the rest.
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const labelled = /(乗車日|利用日|ご利用日|日時|入場日|来館日|予約日時|公演日|搭乗日|visit|date of (use|travel|visit)|travel date|valid on)/i;
  const score = (f: { iso: string; at: number }) => {
    const before = t.slice(Math.max(0, f.at - 24), f.at);
    let s = labelled.test(before) ? 100 : 0;
    if (/(購入|発行|purchase|issued|booked on|有効期限|valid until|expires)/i.test(before)) s -= 50;
    if (f.iso >= today) s += 10;
    return s;
  };
  const unique = [...new Map(found.map((f) => [f.iso, f])).values()];
  return unique.sort((a, b) => score(b) - score(a) || (a.iso < b.iso ? -1 : 1)).map((f) => f.iso);
}

export function findTimes(text: string): string[] {
  const t = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    // OCR drops the 〜 in "13:30〜14:00", leaving "13:3014:00".
    .replace(/(\d{1,2}:\d{2})(?=\d{1,2}:\d{2})/g, "$1 ");
  const times: string[] = [];
  for (const m of t.matchAll(/(?<![\d:])([01]?\d|2[0-3])\s*(?::|時)\s*([0-5]\d)(?:\s*分)?(?![\d:])/g)) times.push(`${pad(m[1])}:${m[2]}`);
  return [...new Set(times)];
}

function guessCategory(text: string, codes: string[]): Category | undefined {
  for (const code of codes) for (const [re, cat] of DOMAIN_HINTS) if (re.test(code)) return cat;
  const lower = text.toLowerCase();
  let best: Category | undefined;
  let bestScore = 0;
  for (const [cat, words] of Object.entries(KEYWORDS) as [Category, (string | RegExp)[]][]) {
    let score = 0;
    for (const w of words) {
      if (typeof w === "string") score += lower.split(w).length - 1;
      else score += (lower.match(new RegExp(w.source, "g" + w.flags.replace("g", ""))) ?? []).length * 2;
    }
    if (score > bestScore) [best, bestScore] = [cat, score];
  }
  return best;
}

const NAME = "[\\u3005\\u3040-\\u30ff\\u4e00-\\u9fffA-Za-z\\-]{1,14}";

function journey(text: string) {
  const out: { from?: string; to?: string; seat?: string; train?: string } = {};
  const arrow = /発/.test(text) ? null : text.match(new RegExp(`(${NAME})\\s*(?:\\d{1,2}:\\d{2})?\\s*発?\\s*(?:→|⇒|➡|➔|->|=>|〜|～|▶|►)\\s*(${NAME})`));
  if (arrow) [out.from, out.to] = [arrow[1], arrow[2]];
  // "東京 10:03発 → 京都 12:18着", where OCR often turns the arrow into 一 or ー.
  const TIME = "(?:\\d{1,2}[:：]\\d{2})?";
  const depArr = text.match(new RegExp(`(${NAME})\\s*${TIME}\\s*発\\s*[一ー−\\-~〜～→⇒➡>・\\s]*\\s*(${NAME})\\s*${TIME}\\s*着`));
  if (depArr) [out.from, out.to] = [depArr[1], depArr[2]];
  if (!out.from) {
    const dep = text.match(new RegExp(`(${NAME})\\s*${TIME}\\s*発`));
    const arr = text.match(new RegExp(`(${NAME})\\s*${TIME}\\s*着`));
    if (dep && arr) [out.from, out.to] = [dep[1], arr[1].replace(/^.*発[一ー−\-~〜～]*/, "")];
  }
  if (out.from) out.from = stationName(out.from.replace(/[発着]$/, ""));
  if (out.to) out.to = stationName(out.to.replace(/[発着]$/, ""));
  const jp = text.match(/(のぞみ|ひかり|こだま|みずほ|さくら|つばめ|はやぶさ|はやて|やまびこ|なすの|こまち|つばさ|とき|たにがわ|かがやき|はくたか|あさま|つるぎ|かもめ)\s*(\d{1,4})\s*号/);
  const en = text.match(/\b(Nozomi|Hikari|Kodama|Mizuho|Sakura|Tsubame|Hayabusa|Hayate|Yamabiko|Nasuno|Komachi|Tsubasa|Toki|Tanigawa|Kagayaki|Hakutaka|Asama|Tsurugi|Kamome)\s*(?:No\.?\s*)?(\d{1,4})/i);
  if (jp) out.train = `${TRAINS[jp[1]]} ${jp[2]}`;
  else if (en) out.train = `${en[1][0].toUpperCase()}${en[1].slice(1).toLowerCase()} ${en[2]}`;
  const seatJp = text.match(/(\d{1,2})\s*号車\s*(\d{1,2})\s*番?\s*([A-E])\s*席?/);
  const seatEn = text.match(/Car\s*(?:No\.?)?\s*(\d{1,2})[^\n]{0,24}?Seat\s*(?:No\.?)?\s*(\d{1,2})\s*-?\s*([A-E])/i);
  const s = seatJp ?? seatEn;
  if (s) out.seat = `Car ${s[1]} · ${s[2]}${s[3].toUpperCase()}`;
  return out;
}

/** Lines that read like a name: not a date, a number, a URL or boilerplate. */
function titleCandidates(text: string, category?: Category): string[] {
  const boring = /^(qr|qrコード|ticket|チケット|e-?ticket|電子チケット|予約確認|reservation|confirmation|お客様|注意|ご注意|please|この|本券|※|https?:|www\.)/i;
  const scored: [string, number][] = [];
  const keywords = category && category !== "other" ? KEYWORDS[category] : [];
  text.split(/\n+/).forEach((raw, i) => {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 3 || line.length > 36 || boring.test(line)) return;
    const letters = line.replace(/[\s\d\-–:/.,()（）￥¥#№]/g, "").length;
    if (letters < line.length * 0.6 || letters < 3) return;
    // OCR noise: brackets and pipes, or short fragments with no real word in them.
    if (/[\[\]|{}<>=_]/.test(line)) return;
    if (!/[\u3040-\u30ff\u4e00-\u9fff]{2,}|[A-Za-z]{3,}/.test(line)) return;
    let score = 10 - Math.min(i, 9);
    if (keywords.some((k) => (typeof k === "string" ? line.toLowerCase().includes(k) : k.test(line.toLowerCase())))) score += 6;
    if (/[一-龯]/.test(line)) score += 1;
    if (/\d{3,}/.test(line)) score -= 4;
    scored.push([line, score]);
  });
  return [...new Set(scored.sort((a, b) => b[1] - a[1]).map(([l]) => l))].slice(0, 4);
}

export function suggest(text: string, codes: string[], now = new Date()): Suggestions {
  const category = guessCategory(text, codes);
  const j = journey(text);
  const titles = titleCandidates(text, category);
  if (j.train || (j.from && j.to)) {
    const route = j.from && j.to ? `${j.from} → ${j.to}` : "";
    titles.unshift([j.train, route].filter(Boolean).join(" · "));
  }
  if (category === "flight") {
    const flight = text.match(/\b(NH|JL|MM|GK|BC|ZG|7G|IJ|HD|6J|[A-Z]{2})\s?(\d{2,4})\b/);
    if (flight) titles.unshift([flight[1], flight[2]].join(" ") + (j.from && j.to ? ` · ${j.from} → ${j.to}` : ""));
  }
  const urlHost = codes.map((c) => c.match(/^https?:\/\/([^/?#]+)/i)?.[1]?.replace(/^www\./, "")).find(Boolean);
  return {
    category: category ?? (j.train ? "train" : undefined),
    titles: [...new Set(titles)].slice(0, 5),
    dates: findDates(text, now).slice(0, 4),
    times: findTimes(text).slice(0, 4),
    from: j.from,
    to: j.to,
    seat: j.seat,
    train: j.train,
    place: urlHost,
  };
}
