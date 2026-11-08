/**
 * Opening and closing a ticket, like Wallet, on the real elements (no view-transition snapshots):
 *
 * - Open: the full-screen ticket starts exactly where its card sits, cut down to the card's head
 *   (clip-path), then slides up and is revealed downward. Its head is the same component as the
 *   card's, so nothing changes shape: one solid object moves and grows. Nothing is scaled or
 *   crossfaded. Meanwhile the stack sinks and fades, the backdrop fades in, and the controls follow
 *   once the ticket has mostly arrived.
 * - Close: the reverse, back into the card's slot (wherever that is now), then the overlay goes.
 *
 * Transforms, clip-path and opacity only. The drawer curve for the object, ease-out for the rest.
 */
const DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const SINK = 36;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const behind = () => [...document.querySelectorAll<HTMLElement>(".app > .header, .app > .main")];

/** Where a card's head sits on screen (the part of the ticket we start from). */
export function cardHead(id: string, sunk = false): { top: number; height: number } | undefined {
  const card = document.querySelector<HTMLElement>(`.card[data-pass="${CSS.escape(id)}"]`);
  const head = card?.querySelector<HTMLElement>(".t-head");
  if (!card || !head) return;
  const r = card.getBoundingClientRect();
  const h = head.getBoundingClientRect();
  // While a ticket is open the stack is sunk by SINK px; measure where it will be once it's back.
  const top = r.top - (sunk ? SINK : 0);
  if (top > innerHeight || top + r.height < 0) return;
  return { top, height: h.bottom - r.top };
}

let sinking: Animation[] = [];

export function animateOpen(root: HTMLElement, ticket: HTMLElement, from?: { top: number; height: number }) {
  const bg = root.querySelector<HTMLElement>(".pager-bg");
  const chrome = [...root.querySelectorAll<HTMLElement>(".fs-bar")].concat(
    [...ticket.closest(".page")!.querySelectorAll<HTMLElement>(".page-actions, .more-hint")],
  );
  if (reduced() || !from) {
    root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease" });
    return;
  }
  const r = ticket.getBoundingClientRect();
  const dy = from.top - r.top;
  const cut = Math.max(0, r.height - from.height);
  ticket.animate(
    [
      { transform: `translateY(${dy}px)`, clipPath: `inset(0 0 ${cut}px 0)` },
      { transform: "translateY(0)", clipPath: "inset(0 0 0px 0)" },
    ],
    { duration: 480, easing: DRAWER },
  );
  bg?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE_OUT, fill: "backwards" });
  for (const el of chrome) el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: 220, easing: EASE_OUT, fill: "backwards" });
  sinking.forEach((a) => a.cancel());
  sinking = behind().map((el) => el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(${SINK}px)` }], { duration: 340, easing: EASE_OUT, fill: "forwards" }));
}

export async function animateClose(root: HTMLElement, ticket: HTMLElement | null, to?: { top: number; height: number }) {
  const bg = root.querySelector<HTMLElement>(".pager-bg");
  const chrome = [...root.querySelectorAll<HTMLElement>(".fs-bar")].concat(ticket ? [...ticket.closest(".page")!.querySelectorAll<HTMLElement>(".page-actions, .more-hint, .page-more")] : []);
  const rise = () => {
    sinking.forEach((a) => a.cancel());
    sinking = [];
    behind().forEach((el) => el.animate([{ opacity: 0, transform: `translateY(${SINK}px)` }, { opacity: 1, transform: "none" }], { duration: 380, easing: DRAWER }));
  };
  if (reduced() || !ticket || !to) {
    rise();
    await root.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(24px)" }], { duration: 220, easing: EASE_OUT, fill: "forwards" }).finished.catch(() => {});
    return;
  }
  const r = ticket.getBoundingClientRect();
  const dy = to.top - r.top;
  const cut = Math.max(0, r.height - to.height);
  for (const el of chrome) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease", fill: "forwards" });
  bg?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 60, easing: EASE_OUT, fill: "forwards" });
  rise();
  await ticket
    .animate(
      [
        { transform: "translateY(0)", clipPath: "inset(0 0 0px 0)" },
        { transform: `translateY(${dy}px)`, clipPath: `inset(0 0 ${cut}px 0)` },
      ],
      { duration: 420, easing: DRAWER, fill: "forwards" },
    )
    .finished.catch(() => {});
}
