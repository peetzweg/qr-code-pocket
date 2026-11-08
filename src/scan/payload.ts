import type { Category } from "../categories";
import { findDates, findTimes } from "./extract";

/**
 * What a code's own payload says, before any OCR: the issuer behind a link, a boarding pass's flight
 * and seat, a calendar event, a contact, Wi-Fi. Everything here is read straight from the code, so it's
 * more reliable than text read off the screenshot and wins over it.
 */
export interface PayloadInfo {
  kind: "link" | "boarding-pass" | "event" | "contact" | "wifi" | "place" | "email" | "phone" | "number" | "text" | "data";
  /** "Boarding pass", "Link to Klook", "Booking number"… */
  label: string;
  issuer?: string;
  category?: Category;
  title?: string;
  date?: string;
  time?: string;
  from?: string;
  to?: string;
  seat?: string;
  place?: string;
  holder?: string;
  reference?: string;
  /** Everything worth showing, in order, for the pass's "In the code" section. */
  details: [string, string][];
}

/** Who's behind a link, by host. Japan travel first. */
const ISSUERS: [RegExp, string, Category?][] = [
  [/smart-ex\.jp|expy\.jp/, "Smart EX", "train"],
  [/eki-net\.com/, "JR East Eki-net", "train"],
  [/jr-odekake\.net|e5489/, "JR West e5489", "train"],
  [/jrkyushu|train\.yoyaku\.jrkyushu/, "JR Kyushu", "train"],
  [/jrhokkaido/, "JR Hokkaido", "train"],
  [/jr-central\.co\.jp/, "JR Central", "train"],
  [/japanrailpass|jrpass/, "Japan Rail Pass", "train"],
  [/vjw|visitjapan|digital\.go\.jp/, "Visit Japan Web"],
  [/klook\.com/, "Klook", "sight"],
  [/kkday\.com/, "KKday", "sight"],
  [/getyourguide/, "GetYourGuide", "sight"],
  [/veltra\.com/, "Veltra", "sight"],
  [/teamlab\.art/, "teamLab", "sight"],
  [/ghibli-museum\.jp|ghibli-park\.jp/, "Ghibli", "sight"],
  [/tokyodisneyresort\.jp/, "Tokyo Disney Resort", "sight"],
  [/usj\.co\.jp/, "Universal Studios Japan", "sight"],
  [/tokyo-skytree\.jp/, "Tokyo Skytree", "sight"],
  [/shibuya-scramble-square|shibuyasky/, "Shibuya Sky", "sight"],
  [/tnm\.jp/, "Tokyo National Museum", "sight"],
  [/tablecheck\.com/, "TableCheck", "food"],
  [/omakase\.in/, "OMAKASE", "food"],
  [/tabelog\.com/, "Tabelog", "food"],
  [/autoreserve\.com/, "AutoReserve", "food"],
  [/toreta\.in|ebica\.jp/, "Restaurant booking", "food"],
  [/ubereats\.com/, "Uber Eats", "food"],
  [/demae-can\.com/, "Demae-can", "food"],
  [/mcdonalds\.co\.jp/, "McDonald's", "food"],
  [/starbucks\.co\.jp/, "Starbucks", "food"],
  [/eplus\.jp/, "e+", "event"],
  [/t\.pia\.jp|pia\.jp/, "Ticket Pia", "event"],
  [/l-tike\.com/, "Lawson Ticket", "event"],
  [/ticketmaster/, "Ticketmaster", "event"],
  [/airbnb\./, "Airbnb", "stay"],
  [/booking\.com/, "Booking.com", "stay"],
  [/agoda\./, "Agoda", "stay"],
  [/jalan\.net/, "Jalan", "stay"],
  [/travel\.rakuten/, "Rakuten Travel", "stay"],
  [/ana\.co\.jp/, "ANA", "flight"],
  [/jal\.co\.jp|jal\.com/, "JAL", "flight"],
  [/flypeach\.com/, "Peach", "flight"],
  [/jetstar\.com/, "Jetstar", "flight"],
  [/zipair\.net/, "ZIPAIR", "flight"],
];

/** Airports, for boarding passes. Unknown codes stay as codes. */
const AIRPORTS: Record<string, string> = {
  HND: "Tokyo Haneda", NRT: "Tokyo Narita", KIX: "Osaka Kansai", ITM: "Osaka Itami", UKB: "Kobe", NGO: "Nagoya", CTS: "Sapporo",
  FUK: "Fukuoka", OKA: "Okinawa", KOJ: "Kagoshima", KMJ: "Kumamoto", NGS: "Nagasaki", HIJ: "Hiroshima", OKJ: "Okayama",
  KMQ: "Komatsu", SDJ: "Sendai", AOJ: "Aomori", HKD: "Hakodate", ISG: "Ishigaki", MMY: "Miyako", TAK: "Takamatsu", MYJ: "Matsuyama",
  ICN: "Seoul", GMP: "Seoul Gimpo", TPE: "Taipei", HKG: "Hong Kong", PVG: "Shanghai", PEK: "Beijing", BKK: "Bangkok", SIN: "Singapore",
  FRA: "Frankfurt", MUC: "Munich", BER: "Berlin", HAM: "Hamburg", DUS: "Düsseldorf", LHR: "London", CDG: "Paris", AMS: "Amsterdam",
  ZRH: "Zurich", VIE: "Vienna", HEL: "Helsinki", IST: "Istanbul", DOH: "Doha", DXB: "Dubai", LAX: "Los Angeles", SFO: "San Francisco", JFK: "New York",
};
const airport = (code: string) => AIRPORTS[code] ?? code;

const pad = (n: number | string) => String(n).padStart(2, "0");

function fromJulian(day: number, now: Date): string | undefined {
  if (!day || day > 366) return;
  // The year isn't in a boarding pass; it's the occurrence of that day nearest to now.
  for (const y of [now.getFullYear(), now.getFullYear() + 1, now.getFullYear() - 1]) {
    const d = new Date(y, 0, day);
    if (Math.abs(d.getTime() - now.getTime()) < 200 * 864e5) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

/** IATA BCBP (Resolution 792): the Aztec / PDF417 on every airline boarding pass. */
function boardingPass(t: string, now: Date): PayloadInfo | undefined {
  if (!/^M[1-4]/.test(t) || t.length < 58) return;
  const name = t.slice(2, 22).trim();
  const pnr = t.slice(23, 30).trim();
  const from = t.slice(30, 33);
  const to = t.slice(33, 36);
  const carrier = t.slice(36, 39).trim();
  const flight = t.slice(39, 44).trim().replace(/^0+/, "");
  const date = fromJulian(Number(t.slice(44, 47)), now);
  const cabin = t.slice(47, 48);
  const seat = t.slice(48, 52).trim().replace(/^0+/, "");
  const seq = t.slice(52, 57).trim().replace(/^0+/, "");
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return;
  const [last, first] = name.split("/");
  const holder = [first, last].filter(Boolean).map((s) => s.charAt(0) + s.slice(1).toLowerCase()).join(" ");
  const flightNo = `${carrier} ${flight}`;
  return {
    kind: "boarding-pass",
    label: "Boarding pass",
    issuer: carrier,
    category: "flight",
    title: `${flightNo} · ${airport(from)} → ${airport(to)}`,
    date,
    from: airport(from),
    to: airport(to),
    seat: seat ? `Seat ${seat}` : undefined,
    holder,
    reference: pnr,
    details: [
      ["Passenger", holder],
      ["Flight", flightNo],
      ["Route", `${from} → ${to}`],
      ...(date ? ([["Date", date]] as [string, string][]) : []),
      ["Seat", seat || "—"],
      ["Cabin", cabin],
      ["Booking", pnr],
      ...(seq ? ([["Sequence", seq]] as [string, string][]) : []),
    ],
  };
}

function icalDate(v: string): { date?: string; time?: string } {
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return {};
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : undefined };
}

function field(t: string, key: string) {
  return t.match(new RegExp(`^${key}(?:;[^:\\n]*)?:(.*)$`, "mi"))?.[1]?.trim().replace(/\\,/g, ",").replace(/\\n/gi, " ");
}

const unescapeMecard = (s?: string) => s?.replace(/\\([;,:\\])/g, "$1");

export function readPayload(text: string, binary = false, now = new Date()): PayloadInfo {
  const t = text.trim();
  if (binary) return { kind: "data", label: "Encoded data", details: [["Size", `${t.length} bytes`]] };

  const bp = boardingPass(t, now);
  if (bp) return bp;

  if (/BEGIN:VEVENT/i.test(t)) {
    const start = icalDate(field(t, "DTSTART") ?? "");
    const title = field(t, "SUMMARY");
    const place = field(t, "LOCATION");
    return {
      kind: "event", label: "Calendar event", title, place, ...start,
      details: [["Event", title ?? "—"], ...(place ? ([["Where", place]] as [string, string][]) : []), ...(start.date ? ([["Starts", `${start.date}${start.time ? ` ${start.time}` : ""}`]] as [string, string][]) : [])],
    };
  }

  if (/^BEGIN:VCARD/i.test(t) || /^MECARD:/i.test(t)) {
    const name = /^MECARD:/i.test(t) ? unescapeMecard(t.match(/N:([^;]*)/)?.[1]) : field(t, "FN") ?? field(t, "N")?.split(";").reverse().join(" ").trim();
    const org = field(t, "ORG");
    return { kind: "contact", label: "Contact card", title: name, details: [["Name", name ?? "—"], ...(org ? ([["Organisation", org]] as [string, string][]) : [])] };
  }

  if (/^WIFI:/i.test(t)) {
    const ssid = unescapeMecard(t.match(/S:((?:\\.|[^;])*)/)?.[1]);
    return { kind: "wifi", label: "Wi-Fi network", title: ssid ? `Wi-Fi ${ssid}` : "Wi-Fi", category: "other", details: [["Network", ssid ?? "—"]] };
  }

  const geo = t.match(/^geo:(-?[\d.]+),(-?[\d.]+)/i);
  if (geo) return { kind: "place", label: "Location", place: `${geo[1]}, ${geo[2]}`, details: [["Coordinates", `${geo[1]}, ${geo[2]}`]] };

  if (/^mailto:/i.test(t)) return { kind: "email", label: "Email address", details: [["To", t.slice(7).split("?")[0]]] };
  if (/^tel:/i.test(t)) return { kind: "phone", label: "Phone number", details: [["Number", t.slice(4)]] };

  if (/^https?:\/\//i.test(t)) {
    let url: URL | undefined;
    try {
      url = new URL(t);
    } catch {
      /* not a real URL */
    }
    if (url) {
      const host = url.hostname.replace(/^www\./, "");
      const hit = ISSUERS.find(([re]) => re.test(host + url!.pathname));
      // Dates hiding in the link: ?date=20261110, /2026-11-10/, visitDate=2026/11/10.
      const flat = decodeURIComponent(url.pathname + " " + url.search).replace(/(20\d{2})(\d{2})(\d{2})(?!\d)/g, "$1-$2-$3").replace(/[?&=_/]/g, " ");
      const date = findDates(flat, now)[0];
      const ref = [...url.searchParams.entries()].find(([k, v]) => /(order|booking|reserv|ticket|voucher|confirm|ref|code|id)/i.test(k) && v.length >= 4 && v.length <= 40)?.[1];
      return {
        kind: "link",
        label: hit ? `${hit[1]} link` : `Link to ${host}`,
        issuer: hit?.[1],
        category: hit?.[2],
        date,
        reference: ref,
        details: [["Issuer", hit?.[1] ?? host], ...(ref ? ([["Reference", ref]] as [string, string][]) : []), ...(date ? ([["Date", date]] as [string, string][]) : [])],
      };
    }
  }

  // Only digits (and dashes): a booking or order number, or a JAN/EAN barcode.
  if (/^[\d\s-]{4,}$/.test(t)) return { kind: "number", label: t.replace(/\D/g, "").length <= 8 ? "Order number" : "Number", reference: t, details: [["Number", t]] };

  // Short codes like "EX-ABC123": a reference. Longer text: look for dates and times in it.
  const date = findDates(t, now)[0];
  const time = findTimes(t)[0];
  const looksLikeRef = /^[A-Z0-9][A-Z0-9-]{3,24}$/i.test(t) && /\d/.test(t);
  return {
    kind: "text",
    label: looksLikeRef ? "Reference" : "Text",
    reference: looksLikeRef ? t : undefined,
    date,
    time,
    details: [[looksLikeRef ? "Reference" : "Text", t.length > 80 ? t.slice(0, 80) + "…" : t], ...(date ? ([["Date", date]] as [string, string][]) : [])],
  };
}
