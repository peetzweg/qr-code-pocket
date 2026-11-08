import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isJourney } from "../categories";
import type { Pass } from "../store/db";
import { deletePass, markUsed, restore, updatePass } from "../store/passes";
import { useTheme } from "../theme";
import { CodeView, useImageUrl } from "./CodeView";
import { Crop } from "./Crop";
import { Fields, fieldsOf } from "./Fields";
import { longDate } from "./format";
import { CategoryIcon, Close } from "./icons";
import { Postmark, postmarkDate } from "./Postmark";
import { bitStrip, bytesOf, microline, serialOf } from "./print";
import { QrImage } from "./qr";
import { QR_STYLES } from "./qrart";
import { Sheet } from "./Sheet";
import { ticketImage } from "./shareImage";
import { StylePager } from "./StylePager";
import { countdown, ticketText } from "./ticketText";
import { prettyFormat } from "./format";
import { vtName } from "./vt";

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const take = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    const onVis = () => document.visibilityState === "visible" && take();
    take();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

/**
 * The tickets, full screen, one per page: flick sideways through them like a wallet. The open
 * ticket's code carries the same view-transition name as its card, so it grows out of the stack.
 */
export function TicketPager({ passes, startId, onCurrent, onClose, onToast }: {
  passes: Pass[];
  startId: string;
  onCurrent: (id: string) => void;
  onClose: () => void;
  onToast: (msg: string, undo?: () => void) => void;
}) {
  useWakeLock();
  const track = useRef<HTMLDivElement>(null);
  const start = Math.max(0, passes.findIndex((p) => p.id === startId));
  const [index, setIndex] = useState(start);
  const [overlay, setOverlay] = useState<"details" | "plain" | "original" | "style" | "edit">();
  const [stamping, setStamping] = useState<string>();
  const pass = passes[index] ?? passes[0];

  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") track.current?.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * track.current.clientWidth, behavior: "smooth" });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [overlay, onClose]);

  // Whatever page is showing names its code for view transitions; keep the deck in step so no two
  // elements ever share a name (the list can shrink under us when a ticket is used or restored).
  useEffect(() => {
    if (pass) onCurrent(pass.id);
  }, [pass?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pass) return null;

  async function use(p: Pass) {
    setStamping(p.id);
    navigator.vibrate?.([12, 40, 18]);
    await new Promise((r) => setTimeout(r, 900));
    // Close first (the code flies back to its card), then move the ticket to Collected.
    onClose();
    await new Promise((r) => setTimeout(r, 460));
    await leave(p.id);
    await markUsed(p.id);
    onToast(`${p.title || "Ticket"} moved to Collected`, () => restore(p.id));
  }

  async function restoreIt(p: Pass) {
    onClose();
    await new Promise((r) => setTimeout(r, 460));
    await leave(p.id);
    await restore(p.id);
    onToast(`${p.title || "Ticket"} is back in Upcoming`);
  }

  async function share(p: Pass) {
    try {
      const png = await ticketImage(p);
      const file = new File([png], `${(p.title || "ticket").replace(/[^\w\- ]+/g, "").trim() || "ticket"}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: p.title });
      else Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: file.name }).click();
    } catch {
      /* cancelled */
    }
  }

  return (
    <motion.div
      className="fullscreen pager"
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      dragSnapToOrigin
      onDragEnd={(_, info) => (info.offset.y > 120 || info.velocity.y > 700) && onClose()}
      style={{ touchAction: "pan-x" }}
    >
      <div className="fs-bar">
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Close /></button>
        <span className="kicker">{index + 1} / {passes.length}</span>
        <button className="link" onClick={() => setOverlay("details")}>Details</button>
      </div>
      <div
        className="pager-track"
        ref={track}
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
          if (i !== index && passes[i]) {
            setIndex(i);
            onCurrent(passes[i].id);
          }
        }}
      >
        {passes.map((p, i) => (
          <TicketPage key={p.id} pass={p} current={i === index} stamping={stamping === p.id} onUse={() => use(p)} onRestore={() => restoreIt(p)} onPlain={() => setOverlay("plain")} />
        ))}
      </div>

      <AnimatePresence>
        {(overlay === "plain" || overlay === "original") && <PlainView pass={pass} original={overlay === "original"} onClose={() => setOverlay(undefined)} />}
        {overlay === "details" && (
          <Sheet key="details" onClose={() => setOverlay(undefined)}>
            <Details pass={pass} onAction={(a) => (a === "share" ? share(pass) : setOverlay(a))} />
          </Sheet>
        )}
        {overlay === "edit" && (
          <Sheet key="edit" onClose={() => setOverlay(undefined)} full>
            <EditTicket pass={pass} onDone={() => setOverlay(undefined)} onDeleted={() => { setOverlay(undefined); onClose(); onToast("Deleted"); }} />
          </Sheet>
        )}
      </AnimatePresence>
      {overlay === "style" && pass.codes[0] && (
        <StyleForTicket pass={pass} onDone={() => setOverlay(undefined)} />
      )}
    </motion.div>
  );
}

/** The card slides out of its stack before the ticket moves to the other list. */
async function leave(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-pass="${CSS.escape(id)}"]`);
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  await el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(28px)" }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }).finished.catch(() => {});
}

function StyleForTicket({ pass, onDone }: { pass: Pass; onDone: () => void }) {
  const wallet = useTheme((t) => t.qrStyle);
  return (
    <StylePager
      code={pass.codes[0]}
      value={pass.style ?? wallet}
      title="Style for this ticket"
      onClose={onDone}
      onPick={async (s) => {
        await updatePass(pass.id, { style: s === wallet ? undefined : s });
        onDone();
      }}
    />
  );
}

function TicketPage({ pass, current, stamping, onUse, onRestore, onPlain }: { pass: Pass; current: boolean; stamping: boolean; onUse: () => void; onRestore: () => void; onPlain: () => void }) {
  const t = ticketText(pass);
  const code = pass.codes[0];
  const bytes = code ? bytesOf(code.text, code.bytes) : new TextEncoder().encode(pass.title);
  const cd = !pass.usedAt ? countdown(pass) : undefined;
  const titleSize = pass.title.length > 26 ? "s" : pass.title.length > 16 ? "m" : "l";
  const micro = microline([pass.title, pass.date, pass.time, pass.from && `${pass.from}>${pass.to ?? ""}`, pass.seat, pass.place, t.info?.reference], code?.text ?? "");
  const source = useImageUrl(code ? undefined : pass.sourceId);
  return (
    <section className="page">
      <div className="ticket">
        <header className="t-head">
          <div className="t-kicker">
            <span className="kicker"><CategoryIcon id={pass.category} size={16} /> {t.issuer}</span>
            <span className="kicker">{t.day ?? "Undated"}</span>
          </div>
          <h2 className={`t-title serif ${titleSize}`}>{pass.title || "Untitled"}</h2>
          <div className="t-when">
            {pass.time && <span className="t-time">{pass.time}</span>}
            <span className="t-sub">
              {cd && <b>{cd}</b>}
              {t.sub && <span>{t.sub}</span>}
            </span>
          </div>
        </header>

        <div className="tear" aria-hidden>
          <i className="notch l" />
          <span className="tear-micro">{micro}</span>
          <i className="notch r" />
        </div>

        <div className="t-code fit">
          <Crop className="fit-box">
            {code ? <QrImage code={code} style={pass.style} vt={current ? vtName(pass.id) : undefined} /> : source ? <img className="t-image" src={source} alt="" /> : null}
            <AnimatePresence>
              {(pass.usedAt || stamping) && (
                <motion.div
                  className="t-postmark"
                  initial={stamping ? { opacity: 0, transform: "scale(1.35) rotate(-18deg)" } : false}
                  animate={{ opacity: 1, transform: "scale(1) rotate(0deg)" }}
                  transition={{ type: "spring", duration: 0.45, bounce: 0.25 }}
                >
                  <Postmark date={postmarkDate(pass.usedAt ?? Date.now())} place={pass.from ?? pass.place} />
                </motion.div>
              )}
            </AnimatePresence>
          </Crop>
        </div>

        <footer className="t-foot">
          <div className="t-bits" dangerouslySetInnerHTML={{ __html: bitStrip(bytes) }} />
          <div className="t-serial">
            <span>{serialOf(bytes)}</span>
            <span>{code ? `${prettyFormat(code.format)} · ${bytes.length} B` : "Image"}{pass.codes.length > 1 ? ` · +${pass.codes.length - 1}` : ""}</span>
          </div>
        </footer>
      </div>
      <div className="page-actions">
        {pass.usedAt ? (
          <button className="btn line wide-flex" onClick={onRestore}>Back to upcoming</button>
        ) : (
          <button className="btn solid wide-flex" onClick={onUse} disabled={stamping}>{stamping ? "Postmarked" : "Mark as used"}</button>
        )}
        <button className="btn line" onClick={onPlain} disabled={!code}>Plain</button>
      </div>
    </section>
  );
}

function PlainView({ pass, original, onClose }: { pass: Pass; original: boolean; onClose: () => void }) {
  const code = pass.codes[0];
  const source = useImageUrl(pass.sourceId);
  return (
    <motion.div className="plain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }} onClick={onClose}>
      {!original && code ? (
        <div className="plain-code"><CodeView code={code} /></div>
      ) : code?.cropId ? (
        <div className="plain-code"><CodeView code={code} original /></div>
      ) : (
        source && <img className="plain-img" src={source} alt="The original screenshot" />
      )}
      <p className="kicker">{original ? "As it was in the screenshot" : "Plain code · same content"} · tap to close</p>
      {original && source && code?.cropId && <img className="plain-img small" src={source} alt="" />}
    </motion.div>
  );
}

function Details({ pass, onAction }: { pass: Pass; onAction: (a: "edit" | "style" | "share" | "original") => void }) {
  const t = ticketText(pass);
  const style = useTheme((s) => pass.style ?? s.qrStyle);
  const source = useImageUrl(pass.sourceId);
  const code = pass.codes[0];
  const facts: [string, string][] = [];
  if (pass.date) facts.push(["When", `${longDate(pass.date)}${pass.time ? `, ${pass.time}` : ""}`]);
  if (isJourney(pass.category) && (pass.from || pass.to)) facts.push(["Route", `${pass.from ?? "?"} → ${pass.to ?? "?"}`]);
  if (pass.seat) facts.push(["Seat", pass.seat]);
  if (pass.place) facts.push(["Where", pass.place]);
  if (pass.notes) facts.push(["Notes", pass.notes]);
  if (pass.usedAt) facts.push(["Used", new Date(pass.usedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })]);
  if (t.info && code) {
    facts.push(["In code", `${t.info.kind === "text" ? prettyFormat(code.format) : t.info.label} · ${code.text.length} characters`]);
    for (const [k, v] of t.info.details) if (!["Text", "Date", "Route", "Seat"].includes(k)) facts.push([k, v]);
  }
  return (
    <div className="sheet-pad">
      <h3 className="sheet-h serif">{pass.title || "Untitled"}</h3>
      <dl className="facts">
        {facts.map(([k, v], i) => (
          <div key={k + i}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        {code && /^https?:\/\//i.test(code.text) && (
          <div><dt>Link</dt><dd><a href={code.text} target="_blank" rel="noreferrer">{code.text.replace(/^https?:\/\//, "").slice(0, 44)}…</a></dd></div>
        )}
      </dl>
      <div className="btn-row">
        <button className="btn line" onClick={() => onAction("style")} disabled={!code}>Style · {QR_STYLES.find((s) => s.id === style)?.label}</button>
        <button className="btn line" onClick={() => onAction("original")} disabled={!source && !code?.cropId}>Original</button>
      </div>
      <div className="btn-row">
        <button className="btn line" onClick={() => onAction("share")}>Share ticket</button>
        <button className="btn line" onClick={() => onAction("edit")}>Edit</button>
      </div>
    </div>
  );
}

function EditTicket({ pass, onDone, onDeleted }: { pass: Pass; onDone: () => void; onDeleted: () => void }) {
  const [fields, setFields] = useState(() => fieldsOf(pass));
  const [codes, setCodes] = useState(pass.codes);
  return (
    <>
      <div className="bar">
        <button className="link" onClick={onDone}>Cancel</button>
        <span className="bar-title">Edit</span>
        <button className="link strong" onClick={async () => { await updatePass(pass.id, { ...fields, codes }); onDone(); }}>Done</button>
      </div>
      <div className="scroll">
        <Fields fields={fields} onChange={setFields} />
        {codes.length > 1 && (
          <dl className="facts">
            {codes.map((c, i) => (
              <div key={c.id}>
                <dt>Code {i + 1}</dt>
                <dd className="code-row">
                  <span className="mono">{c.text.slice(0, 26)}{c.text.length > 26 ? "…" : ""}</span>
                  <button className="link" onClick={() => setCodes(codes.filter((x) => x.id !== c.id))}>Remove</button>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <button className="btn line wide danger" onClick={async () => { if (confirm(`Delete “${pass.title || "this ticket"}”? This can't be undone.`)) { await deletePass(pass.id); onDeleted(); } }}>
          Delete ticket
        </button>
      </div>
    </>
  );
}
