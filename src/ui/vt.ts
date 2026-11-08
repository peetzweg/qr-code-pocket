import { flushSync } from "react-dom";

type VT = { finished: Promise<void> };

/**
 * Runs a state change inside a view transition when the browser has them (Safari 18+, Chrome), so
 * the one element carrying a view-transition-name (the code) morphs between screens. `direction`
 * decides which full screen sits on top while the rest cross over: opening fades the ticket in over
 * the stack; closing fades it out to reveal the stack. Without support it just runs.
 */
export function transition(update: () => void, direction: "open" | "close" = "open") {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => VT };
  if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  const root = document.documentElement;
  root.dataset.vt = direction;
  const t = doc.startViewTransition(() => flushSync(update));
  t.finished.finally(() => {
    if (root.dataset.vt === direction) delete root.dataset.vt;
  });
}

/** CSS-safe view-transition-name for a ticket's code. */
export const vtName = (id: string) => `qr-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
