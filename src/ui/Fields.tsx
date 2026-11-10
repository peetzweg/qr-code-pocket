import { useEffect, useMemo, useRef, useState } from "react";
import { hasServer } from "../inbox";
import { CATEGORIES, isCard, isJourney, isKept, type Category } from "../categories";
import { lookupBrand, siteLabel } from "../scan/brand";
import { putImage } from "../store/db";
import { useImageUrl } from "./CodeView";
import type { Suggestions } from "../scan/extract";
import type { PassFields } from "../scan/importer";
import type { Pass } from "../store/db";
import { dayLabel } from "./format";

export const fieldsOf = (p: Pass): PassFields => ({
  title: p.title, category: p.category, date: p.date, time: p.time, place: p.place, from: p.from, to: p.to, seat: p.seat, notes: p.notes, site: p.site, logoId: p.logoId,
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

export function Fields({ fields, onChange, suggestions, reading, onTouch, touched }: {
  fields: PassFields;
  onChange: (f: PassFields) => void;
  suggestions?: Suggestions;
  reading?: boolean;
  onTouch?: (k: keyof PassFields) => void;
  /** Fields the person has typed in; a looked-up store name only replaces a title they didn't type. */
  touched?: Set<keyof PassFields>;
}) {
  const set = (k: keyof PassFields, v: string) => {
    onTouch?.(k);
    onChange({ ...fields, [k]: k === "title" ? v : v || undefined });
  };
  const src = (k: keyof PassFields) => sourceOf(k, fields[k] as string | undefined, suggestions);
  const journey = isJourney(fields.category);
  const card = isKept(fields.category);
  const store = isCard(fields.category);
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
      <Row label={store ? "Store" : card ? "Name" : "Title"} k="title" value={fields.title} placeholder={reading ? "Reading the ticket…" : store ? "Uniqlo, IKEA Family…" : card ? "Hotel Wi-Fi, home…" : "What is it?"} onChange={set} source={src("title")} />
      {s && <Alternatives items={s.titles} current={fields.title} onPick={(v) => set("title", v)} />}
      {store && <Branding fields={fields} titleIsGuess={!!touched && !touched.has("title")} onChange={(patch) => onChange({ ...fields, ...patch })} />}
      {card ? (
        <Row label="Notes" k="notes" value={fields.notes} placeholder={store ? "Card number, PIN, whose card" : "Where it works, who gave it to you"} onChange={set} multiline />
      ) : (
        <>
      <Row label="Date" k="date" type="date" value={fields.date} placeholder="Add" onChange={set} source={src("date")} />
      {s && <Alternatives items={s.dates} current={fields.date} onPick={(v) => set("date", v)} render={dayLabel} />}
      <Row label="Time" k="time" type="time" value={fields.time} placeholder="Add" onChange={set} source={src("time")} />
      {s && <Alternatives items={s.times} current={fields.time} onPick={(v) => set("time", v)} />}
      {journey && <Row label="From" k="from" value={fields.from} placeholder="Tokyo" onChange={set} source={src("from")} />}
      {journey && <Row label="To" k="to" value={fields.to} placeholder="Kyoto" onChange={set} source={src("to")} />}
      {journey && <Row label="Seat" k="seat" value={fields.seat} placeholder="Car 7 · 12A" onChange={set} source={src("seat")} />}
      <Row label="Where" k="place" value={fields.place} placeholder="Add" onChange={set} source={src("place")} />
      <Row label="Notes" k="notes" value={fields.notes} placeholder="Booking number, who it's for, a memory" onChange={set} multiline />
        </>
      )}
    </div>
  );
}

/**
 * A card's website and logo. Look the site up and the store's own icon (full colour) and name come
 * back; or pick a logo from Photos.
 */
function Branding({ fields, titleIsGuess, onChange }: { fields: PassFields; titleIsGuess: boolean; onChange: (patch: Partial<PassFields>) => void }) {
  const [site, setSite] = useState(fields.site ?? "");
  const [state, setState] = useState<"idle" | "looking" | "failed">("idle");
  const [error, setError] = useState<string>();
  const logo = useImageUrl(fields.logoId);
  const file = useRef<HTMLInputElement>(null);
  const valid = /\w\.\w{2,}/.test(siteLabel(site));
  // Looking a site up needs the app's server; a static copy (GitHub Pages) can only take a picked logo.
  const [lookup, setLookup] = useState(false);
  useEffect(() => void hasServer().then(setLookup), []);

  async function look() {
    if (!valid) return;
    setState("looking");
    try {
      const b = await lookupBrand(site);
      setSite(b.site);
      onChange({ site: b.site, logoId: b.logoId ?? fields.logoId, title: b.name && (titleIsGuess || !fields.title.trim()) ? b.name : fields.title });
      setState(b.logoId ? "idle" : "failed");
      setError(b.logoId ? undefined : "No logo found there. Pick one from Photos instead.");
    } catch (e) {
      onChange({ site: siteLabel(site) });
      setState("failed");
      setError(`Couldn't reach it (${(e as Error).message}). Pick a logo from Photos instead.`);
    }
  }

  return (
    <div className="branding">
      <label className={`field${site ? "" : " empty"}`}>
        <span className="field-label">Website</span>
        <input
          type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search"
          value={site} placeholder="uniqlo.com" onChange={(e) => setSite(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (lookup ? look() : onChange({ site: siteLabel(site) }))}
          onBlur={() => site !== (fields.site ?? "") && valid && (lookup ? look() : onChange({ site: siteLabel(site) }))}
        />
      </label>
      <div className="brand-row">
        <span className="brand-logo">{logo ? <img src={logo} alt="" /> : <span className="brand-blank" />}</span>
        <span className="brand-actions">
          {lookup && <button className="link strong" onClick={look} disabled={!valid || state === "looking"}>{state === "looking" ? "Looking it up…" : "Get logo from site"}</button>}
          <button className={lookup ? "link" : "link strong"} onClick={() => file.current?.click()}>{lookup ? "Choose image" : "Choose logo image"}</button>
          {fields.logoId && <button className="link" onClick={() => onChange({ logoId: undefined })}>Remove</button>}
        </span>
        <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange({ logoId: await putImage(f) });
          e.target.value = "";
        }} />
      </div>
      {state === "failed" && error && <p className="mono-note">{error}</p>}
    </div>
  );
}
