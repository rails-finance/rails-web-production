"use client";

import { useState, useCallback, useEffect } from "react";
import { useTimelineScale, useSingleWallet } from "@/components/shared/activity-timeline";
import { ExpandChevron } from "@/components/shared/expand-chevron";
import { EventCardFooter } from "@/components/shared/event-card-footer";
import type { GasCost } from "@/lib/shared/types/activity";

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
  /** Wallet address — enables TransferLoungeLink in footer */
  wallet?: string;
  /** Gas cost — shown in footer */
  gas?: GasCost;
  /** Extra content in the footer row (e.g., Liquity collateral price) */
  footerExtra?: React.ReactNode;
  /** Suppress the expand/collapse chevron and the header's click-to-toggle
   *  affordance. Used by the simulator shell where detail is always open and
   *  the only dismiss action is an explicit close button. */
  hideDetailChevron?: boolean;
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
  wallet,
  gas,
  footerExtra,
  hideDetailChevron,
}: EventCardProps) {
  const scale = useTimelineScale();
  const singleWallet = useSingleWallet();
  const showAvatar = !singleWallet && !!avatar;

  const [detailOpenInternal, setDetailOpenInternal] = useState(false);
  const [explainerOpenInternal, setExplainerOpenInternal] = useState(false);

  const isControlled = detailOpenProp !== undefined;
  const showDetail = isControlled ? detailOpenProp : detailOpenInternal;
  const isExplainerOpen = explainerOpenProp !== undefined ? explainerOpenProp : explainerOpenInternal;

  const toggleDetail = useCallback(() => {
    const next = !showDetail;
    if (isControlled) {
      onDetailToggle?.(next);
    } else {
      setDetailOpenInternal(next);
    }
  }, [showDetail, isControlled, onDetailToggle]);

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
          showDetail
            ? "rounded-b-none bg-rb-100 dark:bg-rb-900"
            : hasDetail
              ? "hover:bg-rb-100 dark:hover:bg-rb-900"
              : ""
        }`}
      >
        <div
          className={hideDetailChevron ? "" : "group/evt cursor-pointer"}
          onClick={() => { if (hasDetail && !hideDetailChevron) toggleDetail(); }}
          role={hideDetailChevron ? undefined : "button"}
          tabIndex={hideDetailChevron ? undefined : 0}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && hasDetail && !hideDetailChevron) { e.preventDefault(); toggleDetail(); } }}
        >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {header}
          </div>
          {hasDetail && !hideDetailChevron && (
            <ExpandChevron isOpen={showDetail} group="evt" className="mr-5 mt-[18px]" />
          )}
        </div>
        {headerBars}
        {priceBadge && (
          <div className="flex justify-end px-5 pb-2 -mt-1">
            {priceBadge}
          </div>
        )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────── */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showDetail ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        onTransitionEnd={handleDetailTransitionEnd}
      >
        <div className="overflow-hidden">
          {detailMounted && (
            <div className="rounded-b-xl bg-rb-100 dark:bg-rb-900">
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
                      onClick={(e) => { e.stopPropagation(); onDetailRetry(); }}
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {detail}

              {/* ── Info trigger: small (i) stays put so you can
                   peek-and-dismiss without moving the mouse. A
                   chevron appears below only while expanded. ─────── */}
              {(hasExplainer || txHash) && (
                <div className="flex justify-end px-4 pb-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleExplainer(); }}
                    aria-expanded={isExplainerOpen}
                    aria-label={isExplainerOpen ? 'Hide details' : 'Show details'}
                    className="inline-flex flex-col items-center rounded transition-colors text-rb-500 hover:text-rb-400"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                    <svg
                      className={`w-2.5 h-2.5 -mt-0.5 transition-opacity ${isExplainerOpen ? "opacity-100" : "opacity-0"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
              )}

              {/* ── Expanded explainer: bullets + footer metadata ─── */}
              {isExplainerOpen && (hasExplainer || txHash) && (
                <div className="px-3">
                  {hasExplainer && (
                    <div className="px-2 pb-2">
                      {explainerTeaser && (
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className=" shrink-0">•</span>
                          <div className="flex-1 text-sm  leading-relaxed min-w-0">
                            {explainerTeaser}
                          </div>
                        </div>
                      )}
                      {explainer}
                    </div>
                  )}
                  {txHash && <EventCardFooter txHash={txHash} wallet={wallet} gas={gas} extra={footerExtra} />}
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
      <div className="hidden sm:flex w-2/5 shrink-0 self-stretch items-stretch justify-center">
        {iconColumn}
      </div>
      {contentTiers}
    </div>
  );
}
