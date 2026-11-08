import type { Pass } from "../store/db";
import { longDate, prettyFormat } from "./format";
import { CategoryIcon } from "./icons";
import { Postmark, postmarkDate } from "./Postmark";
import { QrImage } from "./qr";
import { countdown, ticketText } from "./ticketText";
import { vtName } from "./vt";

/**
 * Tickets as a stack, like a wallet: each one shows its top band down to the tear line, where the
 * next one lies on it. The code sits in the corner; tap and it grows into the full ticket.
 */
/** `named`: the one card whose code takes part in the view transition (all others must not, or they float above it). */
export function Deck({ passes, onOpen, named, used = false }: { passes: Pass[]; onOpen: (p: Pass) => void; named?: string; used?: boolean }) {
  return (
    <div className="deck">
      {passes.map((p, i) => {
        const t = ticketText(p);
        const cd = !used && i === 0 ? countdown(p) : undefined;
        return (
          <button key={p.id} data-pass={p.id} className={`card${used ? " used" : ""}`} style={{ zIndex: i }} onClick={() => onOpen(p)}>
            <div className="card-head">
              <div className="card-text">
                <span className="kicker">
                  <CategoryIcon id={p.category} size={15} /> {t.issuer}
                  {t.day ? ` · ${t.day}` : ""}
                </span>
                <span className="card-title">{p.title || "Untitled"}</span>
                <span className="card-sub">
                  {p.time && <b>{p.time}</b>}
                  {cd ? ` ${cd}` : t.sub ? ` ${t.sub}` : ""}
                </span>
              </div>
              {p.codes[0] ? (
                <QrImage code={p.codes[0]} style={p.style} vt={named === p.id ? vtName(p.id) : undefined} className="card-qr" />
              ) : (
                <div className="card-qr none"><CategoryIcon id={p.category} size={28} /></div>
              )}
              {used && p.usedAt && <Postmark date={postmarkDate(p.usedAt)} place={p.from ?? p.place} className="card-postmark" />}
            </div>
            <div className="card-tear" aria-hidden />
            <div className="card-foot">
              <span className="mono">{t.sub ?? p.notes?.split("\n")[0] ?? (p.date ? longDate(p.date) : "Undated")}</span>
              <span className="mono">{p.codes[0] ? `${prettyFormat(p.codes[0].format)}${p.codes.length > 1 ? ` ×${p.codes.length}` : ""}` : "Image"}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
