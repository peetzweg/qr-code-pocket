import { useMemo } from "react";
import { CATEGORIES, isJourney, type Category } from "../categories";
import type { Suggestions } from "../scan/extract";
import type { PassFields } from "../scan/importer";
import type { Pass } from "../store/db";
import { dayLabel } from "./format";

export const fieldsOf = (p: Pass): PassFields => ({
  title: p.title, category: p.category, date: p.date, time: p.time, place: p.place, from: p.from, to: p.to, seat: p.seat, notes: p.notes,
});

/** Fills what's still empty from the suggestions; never overwrites what you've typed or picked. */
export function autofill(f: PassFields, s: Suggestions, touched: Set<keyof PassFields>): PassFields {
  const next = { ...f };
  const fill = <K extends keyof PassFields>(k: K, v: PassFields[K] | undefined) => {
    if (v && !touched.has(k) && !next[k]) next[k] = v;
  };
  if (s.category && !touched.has("category") && f.category === "other") next.category = s.category;
  fill("title", s.titles[0]);
  fill("date", s.dates[0]);
  fill("time", s.times[0]);
  fill("from", s.from);
  fill("to", s.to);
  fill("seat", s.seat);
  fill("place", s.place && !/\./.test(s.place) ? s.place : undefined);
  return next;
}

type Source = "code" | "screenshot" | undefined;

/** Where a value came from: exactly from the code's payload, or read off the screenshot. */
function sourceOf(k: keyof PassFields, v: string | undefined, s?: Suggestions): Source {
  if (!v || !s) return;
  const p = s.payload;
  const fromCode: Partial<Record<keyof PassFields, string | undefined>> = p
    ? { title: p.title, date: p.date, time: p.time, from: p.from, to: p.to, seat: p.seat, place: p.place, category: p.category }
    : {};
  if (fromCode[k] && fromCode[k] === v) return "code";
  const shot: Partial<Record<keyof PassFields, string[]>> = { title: s.titles, date: s.dates, time: s.times, from: s.from ? [s.from] : [], to: s.to ? [s.to] : [], seat: s.seat ? [s.seat] : [] };
  if (shot[k]?.includes(v)) return "screenshot";
}

function Row({ label, k, value, type = "text", placeholder, onChange, source, multiline }: {
  label: string; k: keyof PassFields; value?: string; type?: string; placeholder: string; onChange: (k: keyof PassFields, v: string) => void; source?: Source; multiline?: boolean;
}) {
  return (
    <label className={`field${value ? "" : " empty"}`}>
      <span className="field-label">{label}</span>
      {multiline ? (
        <textarea rows={2} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(k, e.target.value)} />
      ) : (
        <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(k, e.target.value)} enterKeyHint="done" />
      )}
      {source && <span className="field-src">{source}</span>}
    </label>
  );
}

function Alternatives({ items, current, onPick, render = (v) => v }: { items: string[]; current?: string; onPick: (v: string) => void; render?: (v: string) => string }) {
  const rest = items.filter((i) => i && i !== current).slice(0, 4);
  if (!rest.length) return null;
  return (
    <div className="alts">
      <span>Also read</span>
      {rest.map((v) => (
        <button key={v} onClick={() => onPick(v)}>{render(v)}</button>
      ))}
    </div>
  );
}

export function Fields({ fields, onChange, suggestions, reading, onTouch }: {
  fields: PassFields;
  onChange: (f: PassFields) => void;
  suggestions?: Suggestions;
  reading?: boolean;
  onTouch?: (k: keyof PassFields) => void;
}) {
  const set = (k: keyof PassFields, v: string) => {
    onTouch?.(k);
    onChange({ ...fields, [k]: k === "title" ? v : v || undefined });
  };
  const src = (k: keyof PassFields) => sourceOf(k, fields[k] as string | undefined, suggestions);
  const journey = isJourney(fields.category);
  const s = suggestions;
  const cats = useMemo(() => CATEGORIES, []);
  return (
    <div className="fields">
      <div className="cats" role="radiogroup" aria-label="Kind">
        {cats.map((c) => (
          <button key={c.id} role="radio" aria-checked={fields.category === c.id} className={fields.category === c.id ? "on" : ""} onClick={() => set("category", c.id as Category)}>
            {c.label}
          </button>
        ))}
      </div>
      <Row label="Title" k="title" value={fields.title} placeholder={reading ? "Reading the ticket…" : "What is it?"} onChange={set} source={src("title")} />
      {s && <Alternatives items={s.titles} current={fields.title} onPick={(v) => set("title", v)} />}
      <Row label="Date" k="date" type="date" value={fields.date} placeholder="Add" onChange={set} source={src("date")} />
      {s && <Alternatives items={s.dates} current={fields.date} onPick={(v) => set("date", v)} render={dayLabel} />}
      <Row label="Time" k="time" type="time" value={fields.time} placeholder="Add" onChange={set} source={src("time")} />
      {s && <Alternatives items={s.times} current={fields.time} onPick={(v) => set("time", v)} />}
      {journey && <Row label="From" k="from" value={fields.from} placeholder="Tokyo" onChange={set} source={src("from")} />}
      {journey && <Row label="To" k="to" value={fields.to} placeholder="Kyoto" onChange={set} source={src("to")} />}
      {journey && <Row label="Seat" k="seat" value={fields.seat} placeholder="Car 7 · 12A" onChange={set} source={src("seat")} />}
      <Row label="Where" k="place" value={fields.place} placeholder="Add" onChange={set} source={src("place")} />
      <Row label="Notes" k="notes" value={fields.notes} placeholder="Booking number, who it's for, a memory" onChange={set} multiline />
    </div>
  );
}
