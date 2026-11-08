import type { Pass } from "../store/db";
import { longDate, prettyFormat } from "./format";
import { Postmark, postmarkDate } from "./Postmark";
import { TicketHead } from "./TicketHead";
import { ticketText } from "./ticketText";

/**
 * Tickets as a stack, like a wallet: each shows its top band (what, when, where) down to the tear
 * line, where the next one lies on it. No code here: a card is for reading. Tap it and the full
 * ticket grows out of it (cardMotion.ts).
 */
export function Deck({ passes, onOpen, used = false }: { passes: Pass[]; onOpen: (p: Pass) => void; used?: boolean }) {
  return (
    <div className="deck">
      {passes.map((p, i) => {
        const t = ticketText(p);
        return (
          <button
            key={p.id}
            data-pass={p.id}
            className={`card${used ? " used" : ""}`}
            style={{ zIndex: i }}
            onClick={() => onOpen(p)}
          >
            <TicketHead pass={p} showCountdown={!used && i === 0} />
            {used && p.usedAt && <Postmark date={postmarkDate(p.usedAt)} place={p.from ?? p.place} className="card-postmark" />}
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
