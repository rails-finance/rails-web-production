"use client";

import { useState, type ReactNode } from "react";
import { ExpandChevron } from "@/components/shared/expand-chevron";

// Generic shell for position/trove/spoke selectors: sticky active card + expandable
// chooser list + chevron button. Each protocol supplies its own card body via
// `renderCard`. Ported from rails-explorer (CardSelectorShell), trimmed for the
// rails-web-mig surface — the chevron alone toggles expansion (the active card
// stays passive so its inner buttons — copy badge, deprecation link — keep
// their own click semantics).

export interface CardSelectorItem {
  id: string;
}

export interface CardRenderProps {
  isActive: boolean;
  isSelected: boolean;
  staticCard: boolean;
  onClick: () => void;
}

export interface CardSelectorShellProps<T extends CardSelectorItem> {
  items: T[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  renderCard: (item: T, props: CardRenderProps) => ReactNode;
  /** Optional reorder for the chooser list (e.g. active first, then by recency). */
  orderItems?: (items: T[]) => T[];
}

export function CardSelectorShell<T extends CardSelectorItem>({
  items,
  selected,
  onSelect,
  renderCard,
  orderItems,
}: CardSelectorShellProps<T>) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const activeItem = items.find(i => i.id === selected) ?? items[0];
  const hasMultiple = items.length > 1;
  const orderedItems = (orderItems ? orderItems(items) : items).filter(i => i.id !== activeItem.id);

  return (
    <div className="group/card flex items-stretch gap-2">
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          {renderCard(activeItem, {
            isActive: true,
            isSelected: expanded,
            staticCard: !hasMultiple,
            onClick: hasMultiple ? () => setExpanded(v => !v) : () => {},
          })}
        </div>

        {hasMultiple && orderedItems.length > 0 && (
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="space-y-3">
                {orderedItems.map(item => (
                  <div key={item.id}>
                    {renderCard(item, {
                      isActive: false,
                      isSelected: false,
                      staticCard: false,
                      onClick: () => {
                        onSelect(item.id);
                        setExpanded(false);
                      },
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {hasMultiple ? (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex flex-col items-center justify-start pt-10 gap-1 shrink-0 cursor-pointer"
          aria-label={expanded ? "Collapse list" : "Expand list"}
        >
          <ExpandChevron isOpen={expanded} group="card" />
        </button>
      ) : (
        // Reserve the chevron column even when there's nothing to expand,
        // so the position card always renders at the same content width.
        // Lets the supplementary stats below stay aligned to the same grid
        // regardless of single- vs multi-position state.
        <div className="shrink-0 w-5" aria-hidden="true" />
      )}
    </div>
  );
}
