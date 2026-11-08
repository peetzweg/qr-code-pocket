import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animateClose, animateOpen, cardHead } from "./cardMotion";
import { isJourney } from "../categories";
import type { Pass } from "../store/db";
import { deletePass, markUsed, restore, updatePass } from "../store/passes";
import { colours, setTheme, useTheme } from "../theme";
import { CodeView, useImageUrl } from "./CodeView";
import { Crop } from "./Crop";
import { Fields, fieldsOf } from "./Fields";
import { longDate } from "./format";
import { Bright, Close } from "./icons";
import { Postmark, postmarkDate } from "./Postmark";
import { bitStrip, bytesOf, microline, serialOf } from "./print";
import { QrImage } from "./qr";
import { QR_STYLES } from "./qrart";
import { Sheet } from "./Sheet";
import { ticketImage } from "./shareImage";
import { StylePager } from "./StylePager";
import { TicketHead } from "./TicketHead";
import { ticketText } from "./ticketText";
import { prettyFormat } from "./format";

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
 * The tickets, full screen, one per page: flick sideways through them like a wallet. It opens out of
 * the tapped card and closes back into the card of whichever ticket is showing (see cardMotion.ts).
 */
export function TicketPager({ passes, startId, onCurrent, onClose: onClosed, onToast }: {
  passes: Pass[];
  startId: string;
  onCurrent: (id: string) => void;
  /** Called once the close animation has finished. */
  onClose: () => void;
  onToast: (msg: string, undo?: () => void) => void;
}) {
  useWakeLock();
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const currentTicket = () => track.current?.children[indexRef.current]?.querySelector<HTMLElement>(".ticket") ?? null;
  const indexRef = useRef(0);
  const start = Math.max(0, passes.findIndex((p) => p.id === startId));
  const [index, setIndex] = useState(start);
  const [overlay, setOverlay] = useState<"plain" | "original" | "style" | "edit">();
  const [stamping, setStamping] = useState<string>();
  const pass = passes[index] ?? passes[0];
  indexRef.current = index;

  // Open: scroll to the tapped ticket, then grow it out of its card, all before the first paint.
  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const t = currentTicket();
    if (root.current && t) animateOpen(root.current, t, cardHead(startId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fold the showing ticket back into its card, then unmount. */
  const onClose = useCallback(async () => {
    if (closing.current || !root.current) return;
    closing.current = true;
    const p = passes[indexRef.current];
    await animateClose(root.current, currentTicket(), p ? cardHead(p.id, true) : undefined);
    onClosed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passes, onClosed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") track.current?.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * track.current.clientWidth, behavior: "smooth" });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [overlay, onClose]);

  useEffect(() => {
    if (pass) onCurrent(pass.id);
  }, [pass?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pass) return null;

  async function use(p: Pass) {
    setStamping(p.id);
    navigator.vibrate?.([12, 40, 18]);
    await new Promise((r) => setTimeout(r, 900));
    // Close first (back into its card), then move the ticket to Collected.
    await onClose();
    await leave(p.id);
    await markUsed(p.id);
    onToast(`${p.title || "Ticket"} moved to Collected`, () => restore(p.id));
  }

  async function restoreIt(p: Pass) {
    await onClose();
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
    <div className="fullscreen pager" ref={root}>
      <div className="pager-bg" aria-hidden />
      <div className="fs-bar">
        <button className="icon-btn" onClick={() => void onClose()} aria-label="Close"><Close /></button>
        <span className="kicker">{index + 1} / {passes.length}</span>
        <BrightToggle />
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
          <TicketPage
            key={p.id}
            pass={p}
            current={i === index}
            stamping={stamping === p.id}
            onUse={() => use(p)}
            onRestore={() => restoreIt(p)}
            onPlain={() => setOverlay("plain")}
            onAction={(a) => (a === "share" ? share(p) : setOverlay(a))}
            onPullClose={onClose}
          />
        ))}
      </div>

      <AnimatePresence>
        {(overlay === "plain" || overlay === "original") && <PlainView pass={pass} original={overlay === "original"} onClose={() => setOverlay(undefined)} />}
        {overlay === "edit" && (
          <Sheet key="edit" onClose={() => setOverlay(undefined)} full>
            <EditTicket pass={pass} onDone={() => setOverlay(undefined)} onDeleted={() => { setOverlay(undefined); onClose(); onToast("Deleted"); }} />
          </Sheet>
        )}
      </AnimatePresence>
      {overlay === "style" && pass.codes[0] && <StyleForTicket pass={pass} onDone={() => setOverlay(undefined)} />}
    </div>
  );
}

/** Bright: the code goes on a lit white plate (an HDR video, which iPhones show brighter than white). */
function BrightToggle() {
  const bright = useTheme((t) => t.bright);
  return (
    <button className={`icon-btn bright${bright ? " on" : ""}`} onClick={() => setTheme({ bright: !bright })} aria-pressed={bright} aria-label="Bright code">
      <Bright />
    </button>
  );
}

/** A tiny looping HDR (HLG) white video: on HDR iPhones it's lit brighter than UI white. */
export function LitPlate() {
  return <video className="lit-video" src={`${import.meta.env.BASE_URL}hdr/white-hlg.mp4`} autoPlay muted loop playsInline disablePictureInPicture aria-hidden />;
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

type Action = "edit" | "style" | "share" | "original";

function TicketPage({ pass, current, stamping, onUse, onRestore, onPlain, onAction, onPullClose }: {
  pass: Pass; current: boolean; stamping: boolean; onUse: () => void; onRestore: () => void; onPlain: () => void; onAction: (a: Action) => void; onPullClose: () => void;
}) {
  const t = ticketText(pass);
  const code = pass.codes[0];
  const bytes = code ? bytesOf(code.text, code.bytes) : new TextEncoder().encode(pass.title);
  const micro = microline([pass.title, pass.date, pass.time, pass.from && `${pass.from}>${pass.to ?? ""}`, pass.seat, pass.place, t.info?.reference], code?.text ?? "");
  const source = useImageUrl(code ? undefined : pass.sourceId);
  const bright = useTheme((s) => s.bright);
  const plainInk = useTheme((s) => colours(s).plainInk);
  const lit = bright && !!code && !pass.usedAt;
  // Pull down at the top to close: iOS rubber-bands (scrollTop < 0); elsewhere, follow the finger.
  const pull = useRef<{ y: number; done: boolean } | undefined>(undefined);
  return (
    <section
      className="page"
      onScroll={(e) => {
        if (e.currentTarget.scrollTop < -72 && !pull.current?.done) {
          pull.current = { y: 0, done: true };
          onPullClose();
        }
      }}
      onTouchStart={(e) => (pull.current = e.currentTarget.scrollTop <= 0 ? { y: e.touches[0].clientY, done: false } : undefined)}
      onTouchMove={(e) => {
        const p = pull.current;
        if (p && !p.done && e.currentTarget.scrollTop <= 0 && e.touches[0].clientY - p.y > 110) {
          p.done = true;
          onPullClose();
        }
      }}
    >
      <div className="page-main">
        <div className="ticket">
          <TicketHead pass={pass} />

          <div className="tear" aria-hidden>
            <i className="notch l" />
            <span className="tear-micro">{micro}</span>
            <i className="notch r" />
          </div>

          <div className="t-code fit">
            <Crop className="fit-box">
              {code ? (
                lit ? (
                  <div className="lit">
                    {current && <LitPlate />}
                    <QrImage code={code} style={pass.style} ink={plainInk} bg="transparent" />
                  </div>
                ) : (
                  <QrImage code={code} style={pass.style} />
                )
              ) : source ? (
                <img className="t-image" src={source} alt="" />
              ) : null}
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
        <div className="more-hint kicker" aria-hidden>Details ↓</div>
      </div>
      <Details pass={pass} onAction={onAction} />
    </section>
  );
}

function PlainView({ pass, original, onClose }: { pass: Pass; original: boolean; onClose: () => void }) {
  const code = pass.codes[0];
  const source = useImageUrl(pass.sourceId);
  return (
    <motion.div className="plain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }} onClick={onClose}>
      <LitPlate />
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

function Details({ pass, onAction }: { pass: Pass; onAction: (a: Action) => void }) {
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
    <div className="page-more">
      <h3 className="section">Details</h3>
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
