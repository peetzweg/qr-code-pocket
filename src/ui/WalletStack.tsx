import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Pass } from "../store/db";
import { markUsed, restore } from "../store/passes";
import { Close } from "./icons";
import { Postmark, postmarkDate } from "./Postmark";
import { Sheet } from "./Sheet";
import { BrightToggle, Details, EditTicket, leave, PlainView, shareTicket, StyleForTicket, TicketFace, useWakeLock, type Action } from "./TicketParts";

/**
 * The wallet, after Apple Wallet's: one scene, no separate screen.
 *
 * - Every card is the whole ticket; stacked, each one covers all but the head of the one before it.
 * - Tap a card: it springs up to the top and is the open ticket; the others spring down into a
 *   fanned stack at the bottom (a little staggered), and the title area fades away.
 * - Tap that stack, pull the ticket down, or press Escape, and everything springs back.
 * - Swipe the open ticket sideways (or use ← →) for the next one.
 * - Overscroll at the top of the list and the cards fan apart.
 *
 * Only transforms move (motion springs); the cards themselves never change size or content.
 */
const SPRING = { type: "spring", stiffness: 320, damping: 34, mass: 1 } as const;
const BAR = 52;
const PEEK = 10;
const GAP_TOP = 18;

function useScreen() {
  const probe = useRef<{ top: number; bottom: number }>({ top: 0, bottom: 0 });
  const [size, setSize] = useState(() => ({ h: innerHeight, head: 150, safeTop: 0, safeBottom: 0 }));
  useLayoutEffect(() => {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none";
    document.body.appendChild(el);
    const measure = () => {
      const cs = getComputedStyle(el);
      probe.current = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
      const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--head")) || 150;
      const h = document.getElementById("root")?.clientHeight || innerHeight;
      setSize({ h, head, safeTop: probe.current.top, safeBottom: probe.current.bottom });
    };
    measure();
    addEventListener("resize", measure);
    return () => {
      removeEventListener("resize", measure);
      el.remove();
    };
  }, []);
  return size;
}

function WakeLock() {
  useWakeLock();
  return null;
}

export function WalletStack({ passes, onToast, onSelecting }: { passes: Pass[]; onToast: (msg: string, undo?: () => void) => void; onSelecting: (on: boolean) => void }) {
  const reduce = useReducedMotion();
  const screen = useScreen();
  const wrap = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<string>();
  const [wrapTop, setWrapTop] = useState(0);
  const [stamping, setStamping] = useState<string>();
  const [overlay, setOverlay] = useState<"plain" | "original" | "style" | "edit">();
  const index = passes.findIndex((p) => p.id === sel);
  const selected = index >= 0 ? passes[index] : undefined;

  // Geometry. The open ticket sits under the bar; the others fan out at the bottom.
  const others = passes.length - (selected ? 1 : 0);
  const fan = Math.min(Math.max(others, 1), 4);
  const stackTop = screen.h - screen.safeBottom - PEEK * fan - 8;
  const openTop = screen.safeTop + BAR;
  const cardH = Math.max(420, (passes.length > 1 ? stackTop - 14 : screen.h - screen.safeBottom - 12) - openTop);

  const select = useCallback(
    (id: string | undefined) => {
      if (id && wrap.current) setWrapTop(wrap.current.getBoundingClientRect().top);
      setSel(id);
      onSelecting(!!id);
      if (id) navigator.vibrate?.(8);
    },
    [onSelecting],
  );

  // A ticket that disappears (used, deleted) closes.
  useEffect(() => {
    if (sel && index < 0) select(undefined);
  }, [sel, index, select]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (overlay) return;
      if (e.key === "Escape") select(undefined);
      if (e.key === "ArrowRight" && passes[index + 1]) select(passes[index + 1].id);
      if (e.key === "ArrowLeft" && passes[index - 1]) select(passes[index - 1].id);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [selected, index, passes, overlay, select]);

  // Overscroll at the top fans the stack apart (iOS rubber-bands the scroller past 0).
  useEffect(() => {
    const main = wrap.current?.closest<HTMLElement>(".main");
    if (!main) return;
    const onScroll = () => wrap.current?.style.setProperty("--spread", `${Math.max(0, -main.scrollTop) * 0.35}px`);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  function yOf(i: number) {
    if (!selected) return GAP_TOP + i * screen.head;
    if (i === index) return openTop - wrapTop;
    const k = i < index ? i : i - 1;
    const slot = Math.min(k, others - 1) - Math.max(0, others - 4);
    return stackTop - wrapTop + Math.max(0, slot) * PEEK;
  }

  async function use(p: Pass) {
    setStamping(p.id);
    navigator.vibrate?.([12, 40, 18]);
    await new Promise((r) => setTimeout(r, 900));
    select(undefined);
    setStamping(undefined);
    await new Promise((r) => setTimeout(r, 520));
    await leave(p.id);
    await markUsed(p.id);
    onToast(`${p.title || "Ticket"} moved to Collected`, () => restore(p.id));
  }
  async function restoreIt(p: Pass) {
    select(undefined);
    await new Promise((r) => setTimeout(r, 520));
    await leave(p.id);
    await restore(p.id);
    onToast(`${p.title || "Ticket"} is back in Upcoming`);
  }
  const act = (a: Action) => (a === "share" ? selected && shareTicket(selected) : setOverlay(a));

  const height = GAP_TOP + Math.max(0, passes.length - 1) * screen.head + cardH + screen.safeBottom + 24;

  return (
    <div className={`wallet${selected ? " has-open" : ""}`} ref={wrap} style={{ height }}>
      {passes.map((p, i) => {
        const open = p.id === sel;
        const k = selected && !open ? (i < index ? i : i - 1) : 0;
        return (
          <motion.div
            key={p.id}
            data-pass={p.id}
            className={`card${open ? " open" : ""}`}
            style={{ zIndex: i, height: cardH, "--i": i, "--card-h": `${cardH}px` } as React.CSSProperties}
            initial={false}
            animate={{ y: yOf(i) }}
            transition={reduce ? { duration: 0 } : { ...SPRING, delay: selected && !open ? 0.012 * k : 0 }}
          >
            <CardBody
              pass={p}
              open={open}
              stamping={stamping === p.id}
              onTap={() => (selected ? (open ? undefined : select(undefined)) : select(p.id))}
              onDismiss={() => select(undefined)}
              onSwipe={(dir) => {
                const next = passes[i + dir];
                if (next) select(next.id);
              }}
              onUse={() => use(p)}
              onRestore={() => restoreIt(p)}
              onPlain={() => setOverlay("plain")}
              onAction={act}
            />
            {p.usedAt && !open && <Postmark date={postmarkDate(p.usedAt)} place={p.from ?? p.place} className="card-postmark" />}
          </motion.div>
        );
      })}

      <AnimatePresence>
        {selected && (
          <motion.div
            key="bar"
            className="wallet-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <WakeLock />
            <button className="icon-btn" onClick={() => select(undefined)} aria-label="Close"><Close /></button>
            <span className="kicker">{index + 1} / {passes.length}</span>
            <BrightToggle />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (overlay === "plain" || overlay === "original") && <PlainView key="plain" pass={selected} original={overlay === "original"} onClose={() => setOverlay(undefined)} />}
        {selected && overlay === "edit" && (
          <Sheet key="edit" onClose={() => setOverlay(undefined)} full>
            <EditTicket pass={selected} onDone={() => setOverlay(undefined)} onDeleted={() => { setOverlay(undefined); select(undefined); onToast("Deleted"); }} />
          </Sheet>
        )}
      </AnimatePresence>
      {selected && overlay === "style" && selected.codes[0] && <StyleForTicket pass={selected} onDone={() => setOverlay(undefined)} />}
    </div>
  );
}

/**
 * A card's content. Open, it scrolls (details below the ticket), follows a downward pull at the top
 * (let go far or fast enough and it closes) and a sideways swipe (next or previous ticket).
 */
function CardBody({ pass, open, stamping, onTap, onDismiss, onSwipe, onUse, onRestore, onPlain, onAction }: {
  pass: Pass; open: boolean; stamping: boolean; onTap: () => void; onDismiss: () => void; onSwipe: (dir: 1 | -1) => void;
  onUse: () => void; onRestore: () => void; onPlain: () => void; onAction: (a: Action) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!open) scroller.current?.scrollTo({ top: 0 });
  }, [open]);

  useEffect(() => {
    const el = scroller.current;
    const d = drag.current;
    if (!open || !el || !d) return;
    let s: { x: number; y: number; t: number } | undefined;
    let axis: "x" | "y" | undefined;
    let dx = 0, dy = 0;
    const set = (tr: string, transition = "none") => {
      d.style.transition = transition;
      d.style.transform = tr;
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length > 1 || (e.target as HTMLElement).closest("button, input, a")) return void (s = undefined);
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
      axis = undefined;
      dx = dy = 0;
      moved.current = false;
    };
    const move = (e: TouchEvent) => {
      if (!s) return;
      const x = e.touches[0].clientX - s.x, y = e.touches[0].clientY - s.y;
      if (!axis) {
        if (Math.hypot(x, y) < 8) return;
        axis = Math.abs(x) > Math.abs(y) ? "x" : "y";
        if (axis === "y" && (y < 0 || el.scrollTop > 0)) return void (s = undefined);
      }
      moved.current = true;
      if (e.cancelable) e.preventDefault();
      if (axis === "y") set(`translateY(${(dy = y)}px)`);
      else set(`translateX(${(dx = x)}px)`);
    };
    const end = () => {
      if (!s || !axis) return void (s = undefined);
      const dt = Math.max(1, performance.now() - s.t);
      s = undefined;
      const back = () => set("none", "transform 420ms cubic-bezier(0.32, 0.72, 0, 1)");
      if (axis === "y") {
        back();
        if (dy > 110 || dy / dt > 0.45) onDismiss();
      } else {
        back();
        if (Math.abs(dx) > 70 || Math.abs(dx) / dt > 0.4) onSwipe(dx < 0 ? 1 : -1);
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [open, onDismiss, onSwipe]);

  return (
    <div
      className="card-scroll"
      ref={scroller}
      onClick={() => {
        if (moved.current) return void (moved.current = false);
        onTap();
      }}
    >
      <div className="card-drag" ref={drag}>
        <TicketFace pass={pass} current={open} stamping={stamping} onUse={onUse} onRestore={onRestore} onPlain={onPlain} />
        {open && (
          <div className="card-details" onClick={(e) => e.stopPropagation()}>
            <Details pass={pass} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  );
}
