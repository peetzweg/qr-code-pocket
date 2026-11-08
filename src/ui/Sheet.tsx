import { usePresence } from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * A bottom sheet (auto height) or a full page that slides up, after Vaul's drawer:
 * - drag it down from the handle, or from anywhere once its content is scrolled to the top;
 *   dragging up there scrolls the content instead;
 * - let go past a quarter of its height, or flick faster than 0.4 px/ms, and it dismisses;
 * - dragged upward it resists (damping) rather than hitting a wall;
 * - the finger is followed by writing the transform directly (no re-render per frame), and the
 *   snap-back and the exit use the iOS drawer curve;
 * - drags starting in inputs are ignored, and only the first touch counts.
 * Works inside AnimatePresence: however it's closed, it slides out before it unmounts.
 */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const VELOCITY = 0.4;

export function Sheet({ onClose, children, full = false, className = "" }: { onClose: () => void; children: ReactNode; full?: boolean; className?: string }) {
  const sheet = useRef<HTMLDivElement>(null);
  const [isPresent, safeToRemove] = usePresence();
  const closing = useRef(false);

  const slide = useCallback((to: string, ms: number) => {
    const el = sheet.current;
    if (!el) return Promise.resolve();
    el.style.transition = `transform ${ms}ms ${EASE}`;
    el.style.transform = to;
    return new Promise<void>((r) => setTimeout(r, ms));
  }, []);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    slide("translateY(100%)", 280).then(onClose);
  }, [onClose, slide]);

  // Enter: from below the screen.
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    el.style.transform = "translateY(100%)";
    el.getBoundingClientRect();
    slide("translateY(0)", 480);
  }, [slide]);

  // Exit when removed from outside (AnimatePresence): slide out, then let it go.
  useEffect(() => {
    if (isPresent) return;
    if (closing.current) return safeToRemove?.();
    closing.current = true;
    slide("translateY(100%)", 260).then(() => safeToRemove?.());
  }, [isPresent, safeToRemove, slide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [dismiss]);

  // Dragging.
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let start: { y: number; t: number; fromHandle: boolean; scroller: HTMLElement | null } | undefined;
    let dragging = false;
    let dy = 0;

    const begin = (y: number, target: EventTarget | null) => {
      const t = target as HTMLElement;
      if (closing.current || t.closest("input, textarea, select, [data-no-drag]")) return;
      const fromHandle = !!t.closest(".grabber-zone");
      const scroller = t.closest<HTMLElement>(".scroll");
      if (!fromHandle && scroller && scroller.scrollTop > 0) return;
      start = { y, t: performance.now(), fromHandle, scroller };
      dragging = false;
      dy = 0;
    };
    const move = (y: number, e: Event) => {
      if (!start) return;
      const d = y - start.y;
      if (!dragging) {
        if (Math.abs(d) < 4) return;
        // Up from the content means scrolling it; only the handle drags upward.
        if (d < 0 && !start.fromHandle) return void (start = undefined);
        if (start.scroller && start.scroller.scrollTop > 0) return void (start = undefined);
        dragging = true;
        el.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      dy = d > 0 ? d : -Math.sqrt(-d) * 2;
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!start) return;
      const s = start;
      start = undefined;
      if (!dragging) return;
      dragging = false;
      const velocity = dy / Math.max(1, performance.now() - s.t);
      if (dy > el.offsetHeight * 0.25 || velocity > VELOCITY) dismiss();
      else slide("translateY(0)", 450);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return void (start = undefined);
      begin(e.touches[0].clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientY, e);
    const onMouseDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      begin(e.clientY, e.target);
      const mm = (ev: PointerEvent) => move(ev.clientY, ev);
      const up = () => {
        end();
        removeEventListener("pointermove", mm);
        removeEventListener("pointerup", up);
      };
      addEventListener("pointermove", mm);
      addEventListener("pointerup", up);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("pointerdown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("pointerdown", onMouseDown);
    };
  }, [dismiss, slide]);

  return (
    <div className="overlay">
      <div className="scrim" onClick={dismiss} />
      <div ref={sheet} className={`sheet ${full ? "full" : ""} ${className}`} role="dialog" aria-modal>
        <div className="grabber-zone">
          <div className="grabber" />
        </div>
        {children}
      </div>
    </div>
  );
}
