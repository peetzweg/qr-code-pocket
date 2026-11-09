import { useEffect, useMemo, useRef, useState } from "react";
import type { Category } from "../categories";
import { combine, draftFromFile, saveDraft, withText, type Draft, type PassFields } from "../scan/importer";
import { prepareOcr, recognize } from "../scan/ocr";
import type { Code } from "../store/db";
import { autofill, Fields } from "./Fields";
import { Crop } from "./Crop";
import { prettyFormat } from "./format";
import { CategoryIcon } from "./icons";
import { QrImage } from "./qr";
import { useImageUrl } from "./CodeView";

function Logo({ id }: { id: string }) {
  const url = useImageUrl(id);
  return url ? <img className="t-logo review-logo" src={url} alt="" /> : null;
}

export type Source = { kind: "file"; file: File } | { kind: "draft"; draft: Draft };

interface Item {
  key: string;
  name: string;
  status: "reading" | "ready" | "error";
  draft?: Draft;
  error?: string;
  fields: PassFields;
  touched: Set<keyof PassFields>;
  ocr: "idle" | "reading" | "done";
  image?: string;
}

const blank = (): PassFields => ({ title: "", category: "other" });

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });

/**
 * Adding tickets: the stamp is drawn first from what was read, and you confirm it. Values come
 * tagged with where they were found; tap one to change it.
 */
export function Review({ sources, onDone }: { sources: Source[]; onDone: (saved: number, categories: Category[]) => void }) {
  const [items, setItems] = useState<Item[]>(() =>
    sources.map((s, i) => ({ key: `i${i}`, name: s.kind === "file" ? s.file.name : s.draft.name, status: "reading", fields: blank(), touched: new Set(), ocr: "idle" })),
  );
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const saved = useRef(0);
  const cats = useRef<Category[]>([]);
  const patch = (key: string, fn: (it: Item) => Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...fn(it) } : it)));

  useEffect(() => {
    prepareOcr();
    let live = true;
    (async () => {
      for (const [i, s] of sources.entries()) {
        const key = `i${i}`;
        try {
          const draft = s.kind === "file" ? await draftFromFile(s.file) : s.draft;
          const image = !draft.codes.length && draft.source ? await toDataUrl(draft.source) : undefined;
          if (live) patch(key, (it) => ({ status: "ready", draft, image, fields: autofill(it.fields, draft.suggestions, it.touched) }));
        } catch (err) {
          console.error(err);
          if (live) patch(key, () => ({ status: "error", error: "Couldn't read this file." }));
        }
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OCR, one item at a time, the current one first.
  useEffect(() => {
    if (items.some((it) => it.ocr === "reading")) return;
    const next = [...items.slice(index), ...items.slice(0, index)].find((it) => it.status === "ready" && it.ocr === "idle");
    if (!next?.draft) return;
    const d = next.draft;
    if (d.textFrom !== "none" || !d.canvas) return patch(next.key, () => ({ ocr: "done" }));
    patch(next.key, () => ({ ocr: "reading" }));
    recognize(d.canvas)
      .then((text) => {
        const draft = withText(d, text);
        patch(next.key, (it) => ({ ocr: "done", draft, fields: autofill(it.fields, draft.suggestions, it.touched) }));
      })
      .catch(() => patch(next.key, () => ({ ocr: "done" })));
  }, [items, index]);

  const item = items[index];
  const allReady = items.every((it) => it.status !== "reading");
  const canCombine = index === 0 && items.length > 1 && allReady && items.filter((it) => it.draft).length > 1;

  const advance = () => (index + 1 >= items.length ? onDone(saved.current, cats.current) : setIndex(index + 1));

  async function save() {
    if (!item?.draft) return advance();
    setSaving(true);
    try {
      await saveDraft(item.draft, { ...item.fields, title: item.fields.title.trim() || "Untitled" });
      saved.current++;
      cats.current.push(item.fields.category);
      advance();
    } finally {
      setSaving(false);
    }
  }

  function doCombine() {
    const draft = combine(items.map((it) => it.draft).filter(Boolean) as Draft[]);
    const touched = new Set<keyof PassFields>();
    setItems([{ key: "combined", name: draft.name, status: "ready", draft, fields: autofill(blank(), draft.suggestions, touched), touched, ocr: items.every((it) => it.ocr === "done") ? "done" : "idle" }]);
    setIndex(0);
  }

  const d = item?.draft;
  const preview = useMemo(() => {
    if (!item || !d) return undefined;
    const codes: Code[] = d.codes.map((c, i) => ({ id: `${item.key}-${i}`, format: c.format, text: c.text, bytes: c.bytes ? (c.bytes.slice().buffer as ArrayBuffer) : undefined }));
    return { ...item.fields, title: item.fields.title || "…", codes, imageHref: item.image, id: item.key };
  }, [item, d]);

  if (!item) return null;
  const reading = item.ocr === "reading" || (item.ocr === "idle" && d?.textFrom === "none" && !!d?.canvas);

  return (
    <>
      <div className="bar">
        <button className="link" onClick={() => onDone(saved.current, cats.current)}>{saved.current ? "Done" : "Cancel"}</button>
        <span className="bar-title">{items.length > 1 ? `${index + 1} / ${items.length}` : item.fields.category === "card" ? "New card" : "New ticket"}</span>
        <button className="link strong" onClick={save} disabled={item.status === "reading" || saving}>Add</button>
      </div>
      <div className="scroll review">
        {canCombine && (
          <button className="combine" onClick={doCombine}>
            Same booking? Combine all {items.length} into one ticket →
          </button>
        )}
        {item.status === "reading" ? (
          <div className="reading-block"><span className="spinner" /> Looking for codes in {item.name}</div>
        ) : item.status === "error" || !d ? (
          <p className="note">{item.error ?? "Nothing to add here."}</p>
        ) : (
          <>
            <div className="review-ticket">
              {item.fields.logoId && <Logo id={item.fields.logoId} />}
              <span className="kicker"><CategoryIcon id={item.fields.category} size={15} /> {d.suggestions.payload?.issuer ?? item.fields.category}</span>
              <span className="serif review-title">{item.fields.title || (reading ? "Reading…" : "Untitled")}</span>
              <Crop className="review-code">
                {preview?.codes[0] ? <QrImage code={preview.codes[0]} /> : item.image ? <img className="t-image" src={item.image} alt="" /> : null}
              </Crop>
            </div>
            <p className="mono-note">
              {d.codes.length === 0 ? "No code found. The image becomes the stamp." : d.codes.length === 1 ? `${prettyFormat(d.codes[0].format)}${d.suggestions.payload && d.suggestions.payload.kind !== "text" ? ` · ${d.suggestions.payload.label}` : ""} · ${d.codes[0].text.length} characters` : `${d.codes.length} codes in one ticket`}
              {reading ? " · reading the text…" : ""}
            </p>
            {d.duplicateOf && <p className="note">Already in your pocket as “{d.duplicateOf}”.</p>}
            <Fields
              fields={item.fields}
              onChange={(fields) => patch(item.key, () => ({ fields }))}
              onTouch={(k) => patch(item.key, (it) => ({ touched: new Set(it.touched).add(k) }))}
              suggestions={d.suggestions}
              reading={reading}
              touched={item.touched}
            />
            <button className="btn solid wide" onClick={save} disabled={saving}>Add to pocket</button>
          </>
        )}
        {items.length > 1 && <button className="link skip" onClick={advance}>Skip this one</button>}
      </div>
    </>
  );
}
