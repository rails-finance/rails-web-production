"use client";

import { InfoDisclosure } from "@/components/shared/info-disclosure";
import { LearnMore, type LearnMoreContent } from "@/components/shared/learn-more-modal";

interface TroveContextRowProps {
  /** Plain-English explanation bullets — rendered below the row when open. */
  items: React.ReactNode[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  /** Panel-scoped FAQ — adds the standardised "?" modal at the panel foot. */
  learnMore?: LearnMoreContent;
}

/**
 * Row 3 of the trove summary stack: the standard bottom-left (i) disclosure.
 * Trove ID + NFT pills live inside the summary card header next to the status
 * pill. When toggled open, the explanation items render as a bulleted list in
 * a rounded panel within the card — the shared `InfoDisclosure` grammar. The
 * optional `learnMore` content adds the standardised "?" FAQ modal at the
 * bottom-right, consolidating the per-bullet "learn more" links.
 */
export function TroveContextRow({ items, isOpen, onToggle, learnMore }: TroveContextRowProps) {
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
      {learnMore && <LearnMore content={learnMore} />}
    </InfoDisclosure>
  );
}
