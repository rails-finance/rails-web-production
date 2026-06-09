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

/** Equal-size surfaced stat card — the shared building block of the
 *  event-detail snapshot grid across protocols. Each section (Collateral,
 *  Debt, LTV, Interest/Borrow Rate) renders as one of these, all sharing a
 *  single CSS grid so they balance in width and — via `sm:auto-rows-fr` on the
 *  grid plus `h-full` here — match the tallest card's height per row. */
export function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl bg-background px-4 py-3">
      <div className="mb-1.5 text-xs font-semibold text-rb-500">{label}</div>
      {children}
    </div>
  );
}

/** Back-compat alias — Liquity's metric components label themselves with
 *  `StateMetric`; it now renders the same boxed `StatCard` as Aave V4 so both
 *  rails share one visual grammar. */
export const StateMetric = StatCard;

export function StateTransition({ children }: { children: ReactNode }) {
  return <div className="flex items-center space-x-1">{children}</div>;
}
