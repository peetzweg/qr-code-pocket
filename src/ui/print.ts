/** Print details made from a code's own content: a serial, microprint, the payload's bits as bars. */

export function hash32(b: Uint8Array) {
  let h = 2166136261;
  for (const x of b) h = Math.imul(h ^ x, 16777619);
  return h >>> 0;
}

export const bytesOf = (text: string, raw?: ArrayBuffer) => (raw ? new Uint8Array(raw) : new TextEncoder().encode(text));

/** "No. 1A49·4551". */
export function serialOf(b: Uint8Array) {
  const x = (hash32(b).toString(16) + hash32(new Uint8Array([...b].reverse())).toString(16)).toUpperCase().padStart(16, "0");
  return `No. ${x.slice(0, 4)}·${x.slice(4, 8)}`;
}

/** The payload, as one long line for microprint. */
export function microline(parts: (string | undefined)[], payload: string, length = 600) {
  const s = [...parts.filter(Boolean), payload].join(" / ").replace(/\s+/g, " ").toUpperCase() + " / ";
  return s.repeat(Math.ceil(length / s.length)).slice(0, length);
}

/** One bar per bit (thick for 1, thin for 0), as an SVG string that stretches to its box. */
export function bitStrip(bytes: Uint8Array, count = 260) {
  let d = "";
  let x = 0;
  const n = Math.max(1, bytes.length);
  for (let i = 0; x < count; i++) {
    const b = bytes[i % n] ?? 0;
    for (let bit = 7; bit >= 0 && x < count; bit--) {
      const w = (b >> bit) & 1 ? 1.3 : 0.5;
      d += `M${x.toFixed(2)} 0h${w}v10h${-w}z`;
      x += w + 0.9;
    }
    x += 1.6;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x.toFixed(1)} 10" preserveAspectRatio="none" width="100%" height="100%"><path d="${d}" fill="currentColor"/></svg>`;
}
