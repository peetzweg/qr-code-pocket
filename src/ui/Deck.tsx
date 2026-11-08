import type { Pass } from "../store/db";
import { CategoryIcon } from "./icons";
import { Postmark, postmarkDate } from "./Postmark";
import { QrImage } from "./qr";
import { countdown, ticketText } from "./ticketText";
import { vtName } from "./vt";

/**
 * Tickets as a stack, like a wallet: each one shows its top band down to the tear line, where the
 * next one lies on it. The code sits in the corner; tap and it grows into the full ticket.
 */
export function Deck({ passes, onOpen, hidden, used = false }: { passes: Pass[]; onOpen: (p: Pass) => void; hidden?: string; used?: boolean }) {
  return (
    <div className="deck">
      {passes.map((p, i) => {
        const t = ticketText(p);
        const cd = !used && i === 0 ? countdown(p) : undefined;
        return (
          <button key={p.id} className={`card${used ? " used" : ""}`} style={{ zIndex: i }} onClick={() => onOpen(p)}>
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
                <QrImage code={p.codes[0]} style={p.style} vt={hidden === p.id ? undefined : vtName(p.id)} className="card-qr" />
              ) : (
                <div className="card-qr none"><CategoryIcon id={p.category} size={28} /></div>
              )}
              {used && p.usedAt && <Postmark date={postmarkDate(p.usedAt)} place={p.from ?? p.place} className="card-postmark" />}
            </div>
            <div className="card-tear" aria-hidden />
            <div className="card-foot">
              <span className="mono">{t.sub ?? t.cat.label}</span>
              <span className="mono">{p.codes.length > 1 ? `${p.codes.length} codes` : t.info?.label ?? "Image"}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
