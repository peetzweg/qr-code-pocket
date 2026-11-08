import type { ReactNode } from "react";

/** A dashed box with × crop marks at its corners, like a print proof. */
export function Crop({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`crop ${className}`}>
      <i className="x tl" />
      <i className="x tr" />
      <i className="x bl" />
      <i className="x br" />
      {children}
    </div>
  );
}
