"use client";

import { useEffect } from "react";
import { useHover } from "@/components/transaction-timeline/context/HoverContext";

interface TroveContextRowProps {
  /** Plain-English explanation bullets — rendered below the row when open. */
  items: React.ReactNode[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

/**
 * Row 3 of the trove summary stack: just the (i) info trigger on the right.
 * Trove ID + NFT pills now live inside the summary card header next to the
 * status pill. When toggled open, explanation items render as a bulleted
 * list in the row below. The (i) icon matches the SVG used by event cards
 * (`components/shared/event-card.tsx`).
 */
export function TroveContextRow({ items, isOpen, onToggle }: TroveContextRowProps) {
  // Mirror the legacy ExplanationPanel behaviour: hover-highlighting is only
  // armed while the panel is open.
  const { setHoverEnabled } = useHover();
  useEffect(() => {
    setHoverEnabled(isOpen);
  }, [isOpen, setHoverEnabled]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => onToggle(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Hide explanation" : "Show explanation"}
          className="inline-flex flex-col items-center rounded transition-colors text-rb-500 hover:text-rb-400 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <svg
            className={`w-2.5 h-2.5 -mt-0.5 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="rounded-lg bg-rb-100 dark:bg-rb-950 px-4 py-3 text-sm text-foreground/90 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-rb-500 select-none">•</span>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
