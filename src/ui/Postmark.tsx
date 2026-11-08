/** A cancellation mark: wavy lines and a round date stamp, in ink. */
export function Postmark({ date, place, className = "" }: { date: string; place?: string; className?: string }) {
  const id = `pm-${(place ?? "x").replace(/\W/g, "")}-${date.replace(/\W/g, "")}`;
  let lines = "";
  for (let k = 0; k < 5; k++) {
    let d = `M0 ${40 + k * 9}`;
    for (let x = 0; x <= 66; x += 3) d += `L${x} ${(40 + k * 9 + Math.sin(x / 6) * 2.2).toFixed(1)}`;
    lines += d;
  }
  return (
    <svg className={`postmark ${className}`} viewBox="0 0 170 120" aria-label={`Used ${date}`}>
      <g fill="none" stroke="currentColor" transform="rotate(-9 110 60)">
        <path d={lines} strokeWidth="1.6" />
        <circle cx="110" cy="60" r="44" strokeWidth="2.2" />
        <circle cx="110" cy="60" r="29" strokeWidth="1" />
        <path id={id} d="M73 60A37 37 0 1 1 147 60" stroke="none" />
        <text fontFamily="var(--sans)" fontSize="9" fontWeight="700" letterSpacing="1.6" fill="currentColor" stroke="none">
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{(place ?? "Used").toUpperCase().slice(0, 16)}</textPath>
        </text>
        <rect x="84" y="51" width="52" height="17" fill="var(--paper-under, var(--bg))" stroke="none" />
        <text x="110" y="64" textAnchor="middle" fontFamily="var(--mono)" fontSize="12" fontWeight="700" fill="currentColor" stroke="none">{date}</text>
      </g>
    </svg>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
export const postmarkDate = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
};

/** The same mark as an SVG string, for drawing onto the share image. */
export function postmarkSvg(date: string, place: string | undefined, color: string, under: string, size: number) {
  let lines = "";
  for (let k = 0; k < 5; k++) {
    let d = `M0 ${40 + k * 9}`;
    for (let x = 0; x <= 66; x += 3) d += `L${x} ${(40 + k * 9 + Math.sin(x / 6) * 2.2).toFixed(1)}`;
    lines += d;
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 120" width="${size}" height="${Math.round((size * 120) / 170)}"><g fill="none" stroke="${color}" transform="rotate(-9 110 60)"><path d="${lines}" stroke-width="1.6"/><circle cx="110" cy="60" r="44" stroke-width="2.2"/><circle cx="110" cy="60" r="29" stroke-width="1"/><path id="a" d="M73 60A37 37 0 1 1 147 60" stroke="none"/><text font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" letter-spacing="1.6" fill="${color}" stroke="none"><textPath href="#a" startOffset="50%" text-anchor="middle">${esc((place ?? "Used").toUpperCase().slice(0, 16))}</textPath></text><rect x="84" y="51" width="52" height="17" fill="${under}" stroke="none"/><text x="110" y="64" text-anchor="middle" font-family="Menlo,monospace" font-size="12" font-weight="700" fill="${color}" stroke="none">${esc(date)}</text></g></svg>`;
}
