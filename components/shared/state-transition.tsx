import type { ReactNode } from "react";

// Small layout atoms for before→after state displays on event detail cards.
// Factored out so Liquity V2, LUSD, the simulator, and any future protocols
// share the same arrow glyph, label styling, and row spacing.

export function TransitionArrow({ size = "md" }: { size?: "sm" | "md" } = {}) {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <svg className={`${cls} text-rb-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ClosedLabel() {
  return <span className="text-sm font-semibold ">CLOSED</span>;
}

export function StateMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-rb-500 font-semibold mb-1">{label}</div>
      {children}
    </div>
  );
}

export function StateTransition({ children }: { children: ReactNode }) {
  return <div className="flex items-center space-x-1">{children}</div>;
}
