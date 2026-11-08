import { useLayoutEffect, useRef, useState } from "react";
import type { Code } from "../store/db";
import { Crop } from "./Crop";
import { Close } from "./icons";
import { QR_STYLES, type QrStyle } from "./qrart";
import { QrImage } from "./qr";

/** Every style, one per page, the code as big as the screen allows. Swipe to compare. */
export function StyleTrack({ code, value, onChange }: { code: Pick<Code, "text" | "format" | "bytes">; value: QrStyle; onChange: (s: QrStyle) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = Math.max(0, QR_STYLES.findIndex((s) => s.id === value));
  const [index, setIndex] = useState(start);
  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="style-track-wrap">
      <div
        className="style-track"
        ref={track}
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
          if (i !== index && QR_STYLES[i]) {
            setIndex(i);
            onChange(QR_STYLES[i].id);
            navigator.vibrate?.(8);
          }
        }}
      >
        {QR_STYLES.map((s, i) => (
          <section className="style-page" key={s.id}>
            <div className="style-head">
              <span className="kicker">{String(i + 1).padStart(2, "0")} / {String(QR_STYLES.length).padStart(2, "0")}</span>
              <h2 className="serif-xl">{s.label}</h2>
              <span className="kicker">{s.hint}</span>
            </div>
            <div className="fit">
              <Crop className="fit-box">
                <QrImage code={code} style={s.id} />
              </Crop>
            </div>
          </section>
        ))}
      </div>
      <div className="dots" aria-hidden>
        {QR_STYLES.map((s, i) => (
          <i key={s.id} className={i === index ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

export function StylePager({ code, value, title, onPick, onClose }: { code: Pick<Code, "text" | "format" | "bytes">; value: QrStyle; title: string; onPick: (s: QrStyle) => void; onClose: () => void }) {
  const [current, setCurrent] = useState(value);
  const label = QR_STYLES.find((s) => s.id === current)?.label;
  return (
    <div className="fullscreen style-pager">
      <div className="fs-bar">
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Close /></button>
        <span className="kicker">{title}</span>
        <span className="icon-btn" />
      </div>
      <StyleTrack code={code} value={value} onChange={setCurrent} />
      <div className="fs-foot">
        <button className="btn solid wide" onClick={() => onPick(current)}>Use {label}</button>
      </div>
    </div>
  );
}
