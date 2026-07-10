"use client";

import { useState, useCallback, useEffect } from "react";
import { useTimelineScale, useSingleWallet } from "@/components/shared/activity-timeline";
import { ExpandChevron } from "@/components/shared/expand-chevron";
import { EventCardFooter } from "@/components/shared/event-card-footer";
import { InfoDisclosure } from "@/components/shared/info-disclosure";
import { isCardOpen, setCardOpen } from "@/lib/shared/card-open-store";

export interface EventCardProps {
  avatar: React.ReactNode;
  iconColumn: React.ReactNode;
  header: React.ReactNode;
  /** Optional row that sits below the header flex row but still inside the
   * header panel container. Rendered at full panel width so its two-column
   * grid aligns with the two-column grid in `detail` below. */
  headerBars?: React.ReactNode;
  detail?: React.ReactNode;
  detailLabel?: string;
  detailIcon?: React.ReactNode;
  explainer?: React.ReactNode;
  explainerLabel?: string;
  explainerIcon?: React.ReactNode;
  detailOpen?: boolean;
  onDetailToggle?: (isOpen: boolean) => void;
  explainerOpen?: boolean;
  onExplainerToggle?: (isOpen: boolean) => void;
  detailLoading?: boolean;
  detailError?: boolean;
  onDetailRetry?: () => void;
  priceBadge?: React.ReactNode;
  /** Teaser line shown at the bottom of the detail panel — first explainer bullet */
  explainerTeaser?: React.ReactNode;
  /** Transaction hash — enables shared footer with Etherscan + TxHashBadge */
  txHash?: string;
  /** Extra content in the footer row (e.g., Liquity collateral price) */
  footerExtra?: React.ReactNode;
  /** Suppress the expand/collapse chevron and the header's click-to-toggle
   *  affordance. Used by the simulator shell where detail is always open and
   *  the only dismiss action is an explicit close button. */
  hideDetailChevron?: boolean;
  /** Stable, globally-unique id for this card. When set (and the detail panel
   *  is uncontrolled), the expanded/collapsed state is persisted to
   *  localStorage and restored on reload / back-navigation. */
  persistKey?: string;
}

/* ── EventCard ───────────────────────────────────────────────────────── */

export function EventCard({
  avatar,
  iconColumn,
  header,
  headerBars,
  detail,
  explainer,
  detailOpen: detailOpenProp,
  onDetailToggle,
  explainerOpen: explainerOpenProp,
  onExplainerToggle,
  detailLoading,
  detailError,
  onDetailRetry,
  priceBadge,
  explainerTeaser,
  txHash,
  footerExtra,
  hideDetailChevron,
  persistKey,
}: EventCardProps) {
  const scale = useTimelineScale();
  const singleWallet = useSingleWallet();
  const showAvatar = !singleWallet && !!avatar;

  const [detailOpenInternal, setDetailOpenInternal] = useState(false);
  const [explainerOpenInternal, setExplainerOpenInternal] = useState(false);

  const isControlled = detailOpenProp !== undefined;
  const showDetail = isControlled ? detailOpenProp : detailOpenInternal;
  const isExplainerOpen = explainerOpenProp !== undefined ? explainerOpenProp : explainerOpenInternal;

  // Restore persisted open state after mount (SSR-safe — no hydration mismatch:
  // first render is always closed, matching the server, then this opens it).
  useEffect(() => {
    if (persistKey && !isControlled && isCardOpen(persistKey)) {
      setDetailOpenInternal(true);
    }
  }, [persistKey, isControlled]);

  const toggleDetail = useCallback(() => {
    const next = !showDetail;
    if (isControlled) {
      onDetailToggle?.(next);
    } else {
      setDetailOpenInternal(next);
      if (persistKey) setCardOpen(persistKey, next);
    }
  }, [showDetail, isControlled, onDetailToggle, persistKey]);

  const toggleExplainer = useCallback(() => {
    const next = !isExplainerOpen;
    if (explainerOpenProp !== undefined) {
      onExplainerToggle?.(next);
    } else {
      setExplainerOpenInternal(next);
    }
  }, [isExplainerOpen, explainerOpenProp, onExplainerToggle]);

  const hasDetail = detail != null || detailLoading || detailError;
  const hasExplainer = explainer != null;

  const [detailMounted, setDetailMounted] = useState(showDetail);

  useEffect(() => {
    if (showDetail) {
      setDetailMounted(true);
    }
  }, [showDetail]);

  const handleDetailTransitionEnd = useCallback(() => {
    if (!showDetail) setDetailMounted(false);
  }, [showDetail]);

  /* ── Content tiers ──────────────────────────────────────────────── */
  const contentTiers = (
    <div className="min-w-0 grow">
      {/* ── Header panel ─────────────────────────────────────────── */}
      <div
        className={`overflow-visible rounded-xl transition-colors ${
          showDetail ? "rounded-b-none bg-raised" : hasDetail ? "hover:bg-raised" : ""
        }`}
      >
        <div
          className={hideDetailChevron ? "" : "group/evt cursor-pointer"}
          onClick={() => {
            if (hasDetail && !hideDetailChevron) toggleDetail();
          }}
          role={hideDetailChevron ? undefined : "button"}
          tabIndex={hideDetailChevron ? undefined : 0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && hasDetail && !hideDetailChevron) {
              e.preventDefault();
              toggleDetail();
            }
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">{header}</div>
            {hasDetail && !hideDetailChevron && (
              <ExpandChevron isOpen={showDetail} group="evt" className="mr-5 mt-[18px]" />
            )}
          </div>
          {headerBars}
          {priceBadge && <div className="flex justify-end px-5 pb-2 -mt-1">{priceBadge}</div>}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────── */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showDetail ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        onTransitionEnd={handleDetailTransitionEnd}
      >
        <div className="overflow-hidden">
          {detailMounted && (
            <div className="rounded-b-xl bg-raised">
              {detailLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm ">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-2 animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
                  </span>
                  Loading&hellip;
                </div>
              )}

              {detailError && !detailLoading && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <span className="text-sm text-red-500">Failed to load data.</span>
                  {onDetailRetry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetailRetry();
                      }}
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {detail}

              {/* ── Plain-language info: standard bottom-left disclosure.
                   The (i) stays put so you can peek-and-dismiss; the panel
                   expands within the card with bullets + footer metadata. ── */}
              {(hasExplainer || txHash) && (
                <div className="px-4 pb-3 pt-1">
                  <InfoDisclosure
                    open={isExplainerOpen}
                    onToggle={toggleExplainer}
                    footer={txHash ? <EventCardFooter txHash={txHash} extra={footerExtra} /> : undefined}
                  >
                    {hasExplainer ? (
                      <div className="text-sm">
                        {explainerTeaser && (
                          <div className="mb-2 flex items-baseline gap-2 text-rb-500">
                            <span className="shrink-0">•</span>
                            <div className="min-w-0 flex-1 leading-relaxed">{explainerTeaser}</div>
                          </div>
                        )}
                        {explainer}
                      </div>
                    ) : null}
                  </InfoDisclosure>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`flex w-full items-start relative ${scale.cardRounded}`}
      style={{ "--card-pad": `${scale.cardPad}px`, padding: scale.cardPad } as React.CSSProperties}
    >
      {showAvatar && avatar}
      {/* Spine area — 2/5 width on desktop, hidden on mobile */}
      <div className="hidden sm:flex w-2/5 shrink-0 self-stretch items-stretch justify-center">{iconColumn}</div>
      {contentTiers}
    </div>
  );
}
