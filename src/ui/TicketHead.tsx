import { isCard } from "../categories";
import type { Pass } from "../store/db";
import { useImageUrl } from "./CodeView";
import { CategoryIcon } from "./icons";
import { countdown, ticketText } from "./ticketText";

/**
 * The top of a ticket: what, when, where. The card in the stack and the open ticket use exactly this,
 * at the same size, so the open/close transition can move and grow one solid object (like Wallet)
 * instead of crossfading two different layouts.
 */
export function TicketHead({ pass, showCountdown = true }: { pass: Pass; showCountdown?: boolean }) {
  const t = ticketText(pass);
  const cd = showCountdown && !pass.usedAt ? countdown(pass) : undefined;
  const card = isCard(pass.category);
  const logo = useImageUrl(pass.logoId);
  return (
    <header className={`t-head${logo ? " has-logo" : ""}`}>
      {logo && <img className="t-logo" src={logo} alt="" />}
      <div className="t-kicker">
        <span className="kicker"><CategoryIcon id={pass.category} size={15} /> {t.issuer}</span>
        <span className="kicker">{t.day ?? (card ? "" : "Undated")}</span>
      </div>
      <h2 className={`t-title serif${pass.title.length > 28 ? " s" : ""}`}>{pass.title || "Untitled"}</h2>
      <div className="t-when">
        {pass.time && <span className="t-time">{pass.time}</span>}
        <span className="t-sub">
          {cd && <b>{cd}</b>}
          {t.sub && <span>{t.sub}</span>}
        </span>
      </div>
    </header>
  );
}
