import type { Pass } from "../store/db";
import { longDate, prettyFormat } from "./format";
import { CategoryIcon } from "./icons";
import { Postmark, postmarkDate } from "./Postmark";
import { countdown, ticketText } from "./ticketText";
import { vtName } from "./vt";

/**
 * Tickets as a stack, like a wallet: each shows its top band (what, when, where) down to the tear
 * line, where the next one lies on it. No code here: a card is for reading. Tap it and the card itself
 * unfolds into the full ticket (it shares a view-transition name with the ticket).
 */
export function Deck({ passes, onOpen, named, used = false }: { passes: Pass[]; onOpen: (p: Pass) => void; named?: string; used?: boolean }) {
  return (
    <div className="deck">
      {passes.map((p, i) => {
        const t = ticketText(p);
        const cd = !used && i === 0 ? countdown(p) : undefined;
        return (
          <button
            key={p.id}
            data-pass={p.id}
            className={`card${used ? " used" : ""}`}
            style={{ zIndex: i, viewTransitionName: named === p.id ? vtName(p.id) : undefined }}
            onClick={() => onOpen(p)}
          >
            <div className="card-head">
              <div className="card-kicker">
                <span className="kicker"><CategoryIcon id={p.category} size={15} /> {t.issuer}</span>
                <span className="kicker">{t.day ?? "Undated"}</span>
              </div>
              <span className="card-title">{p.title || "Untitled"}</span>
              <div className="card-when">
                {p.time && <span className="card-time">{p.time}</span>}
                <span className="card-sub">
                  {cd && <b>{cd}</b>}
                  {t.sub && <span>{t.sub}</span>}
                </span>
              </div>
              {used && p.usedAt && <Postmark date={postmarkDate(p.usedAt)} place={p.from ?? p.place} className="card-postmark" />}
            </div>
            <div className="card-tear" aria-hidden />
            <div className="card-foot">
              <span className="mono">{p.notes?.split("\n")[0] ?? (p.date ? longDate(p.date) : t.cat.label)}</span>
              <span className="mono">{p.codes[0] ? `${prettyFormat(p.codes[0].format)}${p.codes.length > 1 ? ` ×${p.codes.length}` : ""}` : "Image"}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
