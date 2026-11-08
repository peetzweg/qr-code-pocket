import { useState } from "react";
import type { Pass } from "../store/db";
import { BLACK, coloursFor, makeSwatch, modeOf, PALETTE, setLook, setTheme, swatchOf, useTheme, WHITE, type Appearance, type Mode, type Swatch } from "../theme";
import { Crop } from "./Crop";
import { QrImage } from "./qr";

/** A ticket to try colours and styles on. */
export const SAMPLE: Pass = {
  id: "sample",
  title: "Tokyo → Kyoto",
  category: "train",
  date: "2026-11-10",
  time: "10:03",
  from: "Tokyo",
  to: "Kyoto",
  seat: "Car 7 · 12A",
  codes: [{ id: "s1", format: "QRCode", text: "EXIC:9F3A-22B1-0010-7788-NOZOMI23-20261110" }],
  createdAt: 0,
  updatedAt: 0,
};

export function SampleCode() {
  return (
    <Crop className="sample">
      <QrImage code={SAMPLE.codes[0]} />
    </Crop>
  );
}

/** A small ticket in a look's two colours: what Day or Night will look like, code included. */
export function LookPreview({ mode }: { mode: Mode }) {
  const look = useTheme((t) => t[mode]);
  const style = useTheme((t) => t.qrStyle);
  const c = coloursFor(look, mode);
  return (
    <div className="look-preview" style={{ "--fg": c.fg, "--bg": c.bg, background: c.bg, color: c.fg } as React.CSSProperties}>
      <div className="lp-text">
        <span className="kicker">{mode === "day" ? "Day" : "Night"} · {swatchOf(look).name} · {look.fill === "line" ? "Line" : "Flood"}</span>
        <span className="lp-title">Tokyo → Kyoto</span>
        <span className="lp-time">10:03</span>
      </div>
      <Crop className="lp-code">
        <QrImage code={SAMPLE.codes[0]} style={style} ink={c.codeFg} bg={c.codeBg} />
      </Crop>
    </div>
  );
}

export function ColourPicker() {
  const appearance = useTheme((t) => t.appearance);
  const current = useTheme((t) => modeOf(t));
  const [editing, setEditing] = useState<Mode>(current);
  const look = useTheme((t) => t[editing]);
  const [own, setOwn] = useState(look.custom ?? "#2a6f97");
  const paper = editing === "night" ? BLACK : WHITE;
  const shade = (sw: Swatch) => (editing === "night" ? sw.night : sw.day);
  const ownSw = makeSwatch("own", "", "Own", own);
  return (
    <div className="picker">
      <div className="picker-row">
        <span className="kicker">Show</span>
        <div className="seg3">
          {(["day", "night", "auto"] as Appearance[]).map((a) => (
            <button key={a} className={appearance === a ? "on" : ""} onClick={() => { setTheme({ appearance: a }); if (a !== "auto") setEditing(a); }}>
              {a === "day" ? "Day" : a === "night" ? "Night" : "Auto"}
            </button>
          ))}
        </div>
        {appearance === "auto" && <p className="kicker">Day or night, following your phone's appearance.</p>}
      </div>
      <div className="picker-row">
        <div className="edit-tabs" role="tablist">
          {(["day", "night"] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={editing === m} className={editing === m ? "on" : ""} onClick={() => setEditing(m)}>
              {m === "day" ? "Day look" : "Night look"}
            </button>
          ))}
        </div>
        <LookPreview mode={editing} />
      </div>
      <div className="picker-row">
        <span className="kicker">Fill</span>
        <div className="seg3 two">
          <button className={look.fill === "line" ? "on" : ""} onClick={() => setLook(editing, { fill: "line" })}><span className="mode-chip line" /> Line</button>
          <button className={look.fill === "flood" ? "on" : ""} onClick={() => setLook(editing, { fill: "flood" })}><span className="mode-chip flood" /> Flood</button>
        </div>
      </div>
      <div className="picker-row">
        <span className="kicker">Omakase</span>
        <div className="swatches">
          {PALETTE.map((sw) => (
            <button key={sw.id} className={`swatch${look.colour === sw.id ? " on" : ""}`} style={{ "--sw": shade(sw), "--sw-paper": paper } as React.CSSProperties} onClick={() => setLook(editing, { colour: sw.id })} aria-label={sw.name}>
              <b>{sw.kanji}</b>
              <span>{sw.name}</span>
            </button>
          ))}
          <label className={`swatch own${look.colour === "own" ? " on" : ""}`} style={{ "--sw": shade(ownSw), "--sw-paper": paper } as React.CSSProperties}>
            <b>+</b>
            <span>Own</span>
            <input type="color" value={own} onChange={(e) => { setOwn(e.target.value); setLook(editing, { colour: "own", custom: e.target.value }); }} />
          </label>
        </div>
      </div>
    </div>
  );
}
