import { useState } from "react";
import type { Pass } from "../store/db";
import { BLACK, isNight, ownSwatch, PALETTE, setTheme, useTheme, WHITE, type Appearance, type Swatch } from "../theme";
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

export function ColourPicker() {
  const colour = useTheme((t) => t.colour);
  const custom = useTheme((t) => t.custom);
  const appearance = useTheme((t) => t.appearance);
  const fill = useTheme((t) => t.fill);
  const dark = useTheme((t) => isNight(t));
  const [own, setOwn] = useState(custom ?? "#2a6f97");
  const shade = (sw: Swatch) => (dark ? sw.night : sw.day);
  const paper = dark ? BLACK : WHITE;
  const ownSw = ownSwatch(own);
  return (
    <div className="picker">
      <div className="picker-row">
        <span className="kicker">Appearance</span>
        <div className="seg3">
          {(["day", "night", "auto"] as Appearance[]).map((a) => (
            <button key={a} className={appearance === a ? "on" : ""} onClick={() => setTheme({ appearance: a })}>
              {a === "day" ? "Day" : a === "night" ? "Night" : "Auto"}
            </button>
          ))}
        </div>
      </div>
      <div className="picker-row">
        <span className="kicker">Fill</span>
        <div className="seg3 two">
          <button className={fill === "line" ? "on" : ""} onClick={() => setTheme({ fill: "line" })}><span className="mode-chip line" /> Line</button>
          <button className={fill === "flood" ? "on" : ""} onClick={() => setTheme({ fill: "flood" })}><span className="mode-chip flood" /> Flood</button>
        </div>
      </div>
      <div className="picker-row">
        <span className="kicker">Omakase</span>
        <div className="swatches">
          {PALETTE.map((sw) => (
            <button key={sw.id} className={`swatch${colour === sw.id ? " on" : ""}`} style={{ "--sw": shade(sw), "--sw-paper": paper } as React.CSSProperties} onClick={() => setTheme({ colour: sw.id })} aria-label={sw.name}>
              <b>{sw.kanji}</b>
              <span>{sw.name}</span>
            </button>
          ))}
          <label className={`swatch own${colour === "own" ? " on" : ""}`} style={{ "--sw": shade(ownSw), "--sw-paper": paper } as React.CSSProperties}>
            <b>+</b>
            <span>Own</span>
            <input type="color" value={own} onChange={(e) => { setOwn(e.target.value); setTheme({ colour: "own", custom: e.target.value }); }} />
          </label>
        </div>
        {colour === "own" && <p className="kicker">Your colour, with a day and a night shade that keep codes scannable.</p>}
      </div>
    </div>
  );
}
