import { motion, useDragControls } from "motion/react";
import { useEffect, type ReactNode } from "react";

const spring = { type: "spring", stiffness: 420, damping: 40, mass: 0.9 } as const;

/** A bottom sheet (auto height) or a full page, both sliding up, both dismissed by dragging down. */
export function Sheet({ onClose, children, full = false, className = "" }: { onClose: () => void; children: ReactNode; full?: boolean; className?: string }) {
  const drag = useDragControls();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay">
      <div className="scrim" onClick={onClose} />
      <motion.div
        className={`sheet ${full ? "full" : ""} ${className}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={spring}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 600) && onClose()}
        role="dialog"
        aria-modal
      >
        <div className="grabber-zone" onPointerDown={(e) => drag.start(e)}>
          <div className="grabber" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
