"use client";

import { InfoDisclosure } from "@/components/shared/info-disclosure";

interface TroveContextRowProps {
  /** Plain-English explanation bullets — rendered below the row when open. */
  items: React.ReactNode[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

/**
 * Row 3 of the trove summary stack: the standard bottom-left (i) disclosure.
 * Trove ID + NFT pills live inside the summary card header next to the status
 * pill. When toggled open, the explanation items render as a bulleted list in
 * a rounded panel within the card — the shared `InfoDisclosure` grammar.
 */
export function TroveContextRow({ items, isOpen, onToggle }: TroveContextRowProps) {
  if (items.length === 0) return null;

  return (
    <InfoDisclosure open={isOpen} onToggle={onToggle} label="position">
      <div className="text-sm text-foreground/90 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 leading-relaxed">
            <span className="text-rb-500 select-none">•</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </InfoDisclosure>
  );
}
