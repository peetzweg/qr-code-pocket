import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

const PAD = 8;
const R = 11;
const SIZE = 5.6;
/** A monospace glyph's advance, as a share of the font size. */
const ADVANCE = 0.6;
/** Pixels per second. Slow enough to read as a drift, not a ticker. */
const SPEED = 12;

/**
 * The code's own content as microprint, running round it on a rounded frame (in place of the
 * dashed crop edges). The text is two identical laps long and the offset slides back by exactly one
 * repeat (measured, not assumed), so the loop never jumps; rounded corners keep letters from
 * snapping round a right angle. The path starts and ends on the top-left corner, under a small ink
 * dot, like the start mark of a print run, so letters pass under it rather than blink at the join.
 */
export function CodeLoop({ text, running }: { text: string; running: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number }>();
  const textRef = useRef<SVGTextElement>(null);
  const [period, setPeriod] = useState<number>();
  useLayoutEffect(() => {
    const crop = ref.current?.parentElement;
    if (!crop) return;
    const o = parseFloat(getComputedStyle(crop).getPropertyValue("--o")) || 10;
    const measure = () => {
      const w = crop.offsetWidth + 2 * o, h = crop.offsetHeight + 2 * o;
      setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(crop);
    return () => ro.disconnect();
  }, []);
  const id = useRef(`loop${Math.random().toString(36).slice(2, 8)}`).current;
  const half = useRef(0);
  // How far one repeat really is once laid out (letter spacing isn't exact), so the loop restarts invisibly.
  useLayoutEffect(() => {
    const t = textRef.current;
    if (!t || !half.current) return;
    try {
      setPeriod(t.getSubStringLength(0, half.current));
    } catch {
      setPeriod(undefined);
    }
  }, [box, text]);
  if (!box) return <svg ref={ref} className="code-loop" aria-hidden />;

  const { w, h } = box;
  const x0 = PAD, y0 = PAD, x1 = PAD + w, y1 = PAD + h;
  // Start and end at the middle of the top-left corner, where the dot sits.
  const k = R - R / Math.SQRT2;
  const mx = x0 + k, my = y0 + k;
  const path = `M${mx} ${my} A${R} ${R} 0 0 1 ${x0 + R} ${y0} H${x1 - R} A${R} ${R} 0 0 1 ${x1} ${y0 + R} V${y1 - R} A${R} ${R} 0 0 1 ${x1 - R} ${y1} H${x0 + R} A${R} ${R} 0 0 1 ${x0} ${y1 - R} V${y0 + R} A${R} ${R} 0 0 1 ${mx} ${my}`;
  const lap = 2 * (w - 2 * R) + 2 * (h - 2 * R) + 2 * Math.PI * R;
  const fits = Math.floor(lap / (SIZE * ADVANCE));
  const clean = text.replace(/\s+/g, " ").trim() || "QR CODE POCKET";
  let unit = `${clean} · `;
  if (unit.length > fits) unit = `${clean.slice(0, fits - 4)}… · `;
  const lapText = unit.repeat(Math.max(1, Math.round(fits / unit.length)));
  half.current = lapText.length;
  const shift = period ?? lap;
  return (
    <svg ref={ref} className="code-loop" aria-hidden width={w + 2 * PAD} height={h + 2 * PAD}>
      <defs><path id={id} d={path} /></defs>
      <text ref={textRef} fontSize={SIZE} dominantBaseline="central">
        <textPath href={`#${id}`} textLength={2 * lap} lengthAdjust="spacing" startOffset={0}>
          {lapText + lapText}
          {running && !reduce && <animate attributeName="startOffset" from="0" to={-shift} dur={`${shift / SPEED}s`} repeatCount="indefinite" />}
        </textPath>
      </text>
      <circle className="code-loop-dot" cx={mx} cy={my} r={4.2} />
    </svg>
  );
}
