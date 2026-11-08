import type { ReactNode } from "react";

/**
 * A print proof's frame round the code: four dashed edges that stop short of the corners, and a +
 * registration mark centred where each pair of edges would meet, its arms in line with them.
 */
export function Crop({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`crop ${className}`}>
      <i className="edge t" />
      <i className="edge b" />
      <i className="edge l" />
      <i className="edge r" />
      <i className="plus tl" />
      <i className="plus tr" />
      <i className="plus bl" />
      <i className="plus br" />
      {children}
    </div>
  );
}
