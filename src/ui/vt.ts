import { flushSync } from "react-dom";

/**
 * Runs a state change inside a view transition when the browser has them (Safari 18+, Chrome), so
 * elements sharing a view-transition-name (the code) morph between screens. Otherwise it just runs.
 */
export function transition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  doc.startViewTransition(() => flushSync(update));
}

/** CSS-safe view-transition-name for a ticket's code. */
export const vtName = (id: string) => `qr-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
