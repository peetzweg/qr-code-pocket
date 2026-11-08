import { useState } from "react";
import type { Pass } from "../store/db";
import { contrastOnWhite, legible, PALETTE, setTheme, useTheme } from "../theme";
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
  const ink = useTheme((t) => t.ink);
  const inverted = useTheme((t) => t.inverted);
  const [custom, setCustom] = useState(ink);
  const own = !PALETTE.some((p) => p.ink === ink);
  return (
    <div className="picker">
      <div className="swatches">
        {PALETTE.map((p) => (
          <button key={p.ink} className={`swatch${p.ink === ink ? " on" : ""}`} style={{ "--sw": p.ink } as React.CSSProperties} onClick={() => setTheme({ ink: p.ink })} aria-label={p.name}>
            <i />
            <span>{p.name}</span>
          </button>
        ))}
        <label className={`swatch${own ? " on" : ""}`} style={{ "--sw": own ? ink : custom } as React.CSSProperties}>
          <i />
          <span>Own</span>
          <input type="color" value={custom} onChange={(e) => { setCustom(e.target.value); setTheme({ ink: legible(e.target.value) }); }} />
        </label>
      </div>
      {own && contrastOnWhite(custom) < 4.5 && <p className="kicker">Darkened a little so codes still scan.</p>}
      <div className="mode">
        <button className={!inverted ? "on" : ""} onClick={() => setTheme({ inverted: false })}><span className="mode-chip paper" /> Ink on paper</button>
        <button className={inverted ? "on" : ""} onClick={() => setTheme({ inverted: true })}><span className="mode-chip ink" /> Paper on ink</button>
      </div>
    </div>
  );
}
