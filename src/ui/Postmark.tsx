import { useId } from "react";

/**
 * The used mark: a rubber date stamp, pressed hard. A heavy double ring, the place around the top,
 * USED · 使用済 around the bottom, the date big across the middle; a little ink grain and a ragged
 * edge so it reads as pressed, not drawn. One ink, like everything else.
 */
export function stampSvg({ date, place, color, id, size, archived }: { date: string; place?: string; color: string; id: string; size?: number; archived?: boolean }) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const seed = [...date + (place ?? "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  const top = esc((place ?? "Collected").toUpperCase().slice(0, 18));
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${dims}>
<defs>
<filter id="${id}f" x="-5%" y="-5%" width="110%" height="110%">
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -6 0 0 0 4.3" result="m"/>
<feComposite in="SourceGraphic" in2="m" operator="in" result="t"/>
<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${seed + 1}" result="w"/>
<feDisplacementMap in="t" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<path id="${id}t" d="M30 100A70 70 0 0 1 170 100"/>
<path id="${id}b" d="M20 100A80 80 0 0 0 180 100"/>
</defs>
<g filter="url(#${id}f)" fill="${color}" stroke="${color}">
<circle cx="100" cy="100" r="90" fill="none" stroke-width="8"/>
<circle cx="100" cy="100" r="62" fill="none" stroke-width="2.5"/>
<text font-family="Helvetica Neue,Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="2" stroke="none"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${top}</textPath></text>
<text font-family="Helvetica Neue,Arial,Hiragino Sans,sans-serif" font-size="13" font-weight="800" letter-spacing="2" stroke="none"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${archived ? "★ ARCHIVED · 保管 ★" : "★ USED · 使用済 ★"}</textPath></text>
<rect x="44" y="78" width="112" height="4" stroke="none"/>
<rect x="44" y="118" width="112" height="4" stroke="none"/>
<text x="100" y="110" text-anchor="middle" font-family="SF Mono,Menlo,monospace" font-size="23" font-weight="800" letter-spacing="0" stroke="none">${esc(date)}</text>
</g>
</svg>`;
}

export function Postmark({ date, place, className = "", archived }: { date: string; place?: string; className?: string; archived?: boolean }) {
  const id = `s${useId().replace(/\W/g, "")}`;
  return <span className={`postmark ${className}`} role="img" aria-label={`${archived ? "Archived" : "Used"} ${date}`} dangerouslySetInnerHTML={{ __html: stampSvg({ date, place, color: "currentColor", id, archived }) }} />;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const postmarkDate = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
};

/** The same stamp as an SVG string, for drawing onto the share image. */
export const postmarkSvg = (date: string, place: string | undefined, color: string, _under: string, size: number, archived = false) => stampSvg({ date, place, color, id: "pm", size, archived });
