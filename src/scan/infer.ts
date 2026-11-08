import { suggest, type Suggestions } from "./extract";
import { readPayload, type PayloadInfo } from "./payload";

/**
 * Suggestions from both sources: the code's payload (exact) first, then the text read off the image
 * (OCR or PDF text). Where both say something, the payload wins and the other becomes an alternative.
 */
export function infer(text: string, codes: { text: string; binary?: boolean }[]): Suggestions & { payload?: PayloadInfo } {
  const fromText = suggest(text, codes.map((c) => c.text));
  const payload = codes.length ? readPayload(codes[0].text, codes[0].binary) : undefined;
  if (!payload) return fromText;
  const first = <T,>(a: T | undefined, list: T[]) => (a ? [a, ...list.filter((x) => x !== a)] : list);
  const issuerTitle = payload.issuer && !payload.title && !fromText.titles.length ? `${payload.issuer} booking` : undefined;
  return {
    ...fromText,
    payload,
    category: payload.category ?? fromText.category,
    titles: first(payload.title ?? issuerTitle, fromText.titles).slice(0, 5),
    dates: first(payload.date, fromText.dates),
    times: first(payload.time, fromText.times),
    from: payload.from ?? fromText.from,
    to: payload.to ?? fromText.to,
    seat: payload.seat ?? fromText.seat,
    place: payload.place ?? fromText.place,
  };
}
