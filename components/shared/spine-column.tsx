"use client";

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { ArrowFromDot } from "@/components/shared/timeline-spine";
import { useTimelineScale, SpineVal } from "@/components/shared/activity-timeline";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";

// ── Icon overrides ──────────────────────────────────────────────────────────

/** Semantic icon that replaces token icons when the event isn't about token flow */
export type SpineIcon =
  | "warning" // Passive loss: liquidation, redemption (amber triangle; red via warningTone)
  | "rate-change" // Interest rate / parameter change (% with up/down arrow)
  | "delegate" // Delegation change (users icon with +/- badge)
  | "reward" // Reward claim / airdrop (sparkle)
  | "shield" // Approval / security event
  | "unlock"; // Token unlock (token icon + lock-open badge)

/** Spine line style encoding agency */
export type SpineVariant = "solid" | "dotted";

/** Optional spine color tint — encodes subsystem or event category */
export type SpineColor = "default" | "blue" | "emerald" | "violet" | "amber" | "red";

const SPINE_COLORS: Record<SpineColor, string> = {
  default: "rgb(101 115 140)", // rb-500
  blue: "rgb(59 130 246)", // blue-500
  emerald: "rgb(16 185 129)", // emerald-500
  violet: "rgb(139 92 246)", // violet-500
  amber: "rgb(245 158 11)", // amber-500
  red: "rgb(239 68 68)", // red-500
};

/** Pulsing dot color matching spine tint */
const DOT_COLORS: Record<SpineColor, string> = {
  default: "bg-emerald-400",
  blue: "bg-blue-400",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
};

// ── Token row descriptor ────────────────────────────────────────────────────

export interface SpineTokenRow {
  /** Token symbol for the icon */
  symbol: string;
  /** Token contract address — fallback for icon lookup via Trust Wallet CDN */
  address?: string;
  /** Arrow direction: left = toward wallet, right = toward protocol */
  direction?: "left" | "right";
  /** Optional flanking value shown beside the arrow */
  value?: number | string;
  /** Optional badge overlay on the token icon */
  badge?: "check" | "cross";
  /** When set, the flanking value renders as a click-to-edit input. Used by
   *  simulator cards so the spine values are interactive in sim mode. */
  onValueChange?: (v: number) => void;
  /** Decimals for the inline edit input (defaults to 4). */
  valueDecimals?: number;
  /** Inclusive upper bound for the inline edit input. */
  valueMax?: number;
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface SpineColumnProps {
  /** Token rows: 1 for single-asset events, 2 for dual-asset (collateral+debt, swap) */
  tokens?: SpineTokenRow[];
  /** Semantic icon override — replaces token icons entirely */
  icon?: SpineIcon;
  /** Tone for the "warning" triangle — amber for recoverable events (redemption),
   *  red for terminal ones (liquidation). Defaults to amber. */
  warningTone?: "amber" | "red";
  /** Direction for rate-change arrow or delegate badge */
  iconDirection?: "up" | "down";
  /** Token symbol for icon types that show a token (e.g. "unlock") */
  tokenSymbol?: string;
  /** Spine line style: solid = user-initiated, dotted = passive/external */
  spine?: SpineVariant;
  /** Spine color tint — encodes subsystem or event category */
  color?: SpineColor;
  /** Whether this is the first (newest) card — shows pulsing green dot above */
  isFirst?: boolean;
  /** Whether this is the last card in the timeline (hides trailing spine) */
  isLast: boolean;
  /** Detached column — no trailing spine and no trailing background mask. Used by the simulator card, which no longer sits in the timeline. */
  detached?: boolean;
}

// ── Icon SVGs ───────────────────────────────────────────────────────────────

function WarningIcon({ size, color = "#F59E0B" }: { size: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function RateIcon({ size, color = "var(--color-rb-500)" }: { size: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function DirectionArrow({ direction, size }: { direction: "up" | "down"; size: number }) {
  const color = direction === "up" ? "#22C55E" : "#EF4444";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "up" ? (
        <>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </>
      ) : (
        <>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </>
      )}
    </svg>
  );
}

function RewardIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FBBF24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function ShieldIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-rb-500)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

/** Green circle with white checkmark — overlaid bottom-right of token icon */
function CheckBadge({ size }: { size: number }) {
  const r = Math.round(size * 0.48);
  return (
    <div
      className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center"
      style={{ width: r, height: r, backgroundColor: "#22C55E", border: "2px solid var(--background)" }}
    >
      <svg width={r * 0.6} height={r * 0.6} viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Red circle with white X — overlaid bottom-right of token icon */
function CrossBadge({ size }: { size: number }) {
  const r = Math.round(size * 0.4);
  return (
    <div
      className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center"
      style={{ width: r, height: r, backgroundColor: "#EF4444", border: "2px solid var(--background)" }}
    >
      <svg width={r * 0.55} height={r * 0.55} viewBox="0 0 12 12" fill="none">
        <path d="M3 3L9 9M9 3L3 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Lock-open badge — overlaid bottom-right of token icon for unlock events */
function LockOpenBadge() {
  return (
    <div
      className="absolute -bottom-0.5 text-green-700 -right-0.5 rounded-full flex items-center justify-center"
      style={{ width: 16, height: 16, backgroundColor: "currentColor", outline: "2px solid var(--background)" }}
    >
      <svg
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    </div>
  );
}

/** Pulsing dot for the newest event in an active timeline — color matches spine tint */
function PulsingDot({ dotClass = "bg-emerald-400" }: { dotClass?: string }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
      <span className={`absolute inline-flex h-full w-full rounded-full ${dotClass} opacity-50 animate-ping`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
    </div>
  );
}

/** Covers the spine tail from the previous card that extends into the space below
 *  the last card's icon. Bounded by the flex-1 parent (which spans from the icon's
 *  bottom to the card's bottom) so it never bleeds past the card boundary. */
function SpineTrailingMask() {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-10"
      style={{ top: 0, bottom: 0, width: 12, backgroundColor: "var(--background)" }}
    />
  );
}

// ── SpineColumn ─────────────────────────────────────────────────────────────

export function SpineColumn({
  tokens,
  icon,
  warningTone = "amber",
  iconDirection,
  tokenSymbol,
  spine = "solid",
  color = "default",
  isFirst,
  isLast,
  detached,
}: SpineColumnProps) {
  const scale = useTimelineScale();
  const { showTimelineValues } = useTimelineDisplay();

  const spineRgb = SPINE_COLORS[color];
  const dotClass = DOT_COLORS[color];
  const isDotted = spine === "dotted";
  const spineStyle = isDotted
    ? { backgroundImage: `linear-gradient(to bottom, ${spineRgb} 50%, transparent 50%)`, backgroundSize: "1px 6px" }
    : { backgroundColor: spineRgb };
  const spineClasses = "absolute left-1/2 -translate-x-1/2 w-px";

  const spineEl = detached ? (
    // Detached card: spine is bounded by the column itself, no overflow into neighbours.
    <div className={spineClasses} style={{ top: 0, bottom: 0, ...spineStyle }} />
  ) : (
    !isLast && (
      // Overshoot past the card bottom just enough to reach into the *next*
      // icon's halo (where it's masked by var(--background) box-shadow), then
      // stop. Layout assumes the standard sibling spacing — space-y-2 (8px
      // gap) + cardPad (4px) + SpineColumn pt-4 (16px) − halo radius (4px) ≈
      // 24px from this card's bottom to the next halo's top edge; 28px lands
      // a few px inside the halo for clean masking. Any further (the old
      // 100px) and the spine bleeds past the next card entirely, leaving a
      // bare tail visible below the bottom-most event.
      <div className={spineClasses} style={{ top: 0, bottom: "calc(-1 * var(--card-pad) - 28px)", ...spineStyle }} />
    )
  );

  // Lead-in line + pulsing dot above the first (newest) event — absolutely positioned so it doesn't push the icon down
  const leadIn = isFirst && (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
      style={{ bottom: "100%", paddingBottom: 4 }}
    >
      <PulsingDot dotClass={dotClass} />
      <div className="w-px" style={{ height: 12, backgroundColor: spineRgb }} />
    </div>
  );

  // Icon override mode — no token icons, just a semantic icon
  if (icon) {
    const iconContent = (() => {
      switch (icon) {
        case "warning":
          return (
            <div
              className="grid grid-rows-1 items-center justify-items-center"
              style={{ gridTemplateColumns: scale.gridCols }}
            >
              <span />
              <span />
              <WarningIcon
                size={scale.tokenSize}
                color={warningTone === "red" ? SPINE_COLORS.red : SPINE_COLORS.amber}
              />
              <span />
              <span />
            </div>
          );
        case "rate-change":
          return (
            <div
              className="grid grid-rows-1 items-center justify-items-center"
              style={{ gridTemplateColumns: scale.gridCols }}
            >
              <span />
              <span />
              <RateIcon size={scale.tokenSize} />
              <DirectionArrow direction={iconDirection ?? "up"} size={Math.round(scale.arrowSize * 0.7)} />
              <span />
            </div>
          );
        case "delegate":
          return (
            // Mirrors the rate-change row: % glyph + up/down direction arrow.
            // Tinted purple to match the "Delegate"/batch-manager pill colour
            // used elsewhere in the trove header.
            <div
              className="grid grid-rows-1 items-center justify-items-center"
              style={{ gridTemplateColumns: scale.gridCols }}
            >
              <span />
              <span />
              <RateIcon size={scale.tokenSize} color="#A78BFA" />
              <DirectionArrow direction={iconDirection ?? "up"} size={Math.round(scale.arrowSize * 0.7)} />
              <span />
            </div>
          );
        case "reward":
          return (
            <div
              className="grid grid-rows-1 items-center justify-items-center"
              style={{ gridTemplateColumns: scale.gridCols }}
            >
              <span />
              <span />
              <RewardIcon size={scale.tokenSize} />
              <span />
              <span />
            </div>
          );
        case "shield":
          return (
            <div
              className="grid grid-rows-1 items-center justify-items-center"
              style={{ gridTemplateColumns: scale.gridCols }}
            >
              <span />
              <span />
              <ShieldIcon size={scale.tokenSize} />
              <span />
              <span />
            </div>
          );
        case "unlock":
          return (
            <div
              className="grid grid-rows-1 items-center justify-items-center"
              style={{ gridTemplateColumns: scale.gridCols }}
            >
              <span />
              <span />
              <div className="relative">
                <TokenChipIcon symbol={tokenSymbol ?? "FPS"} size={scale.tokenSize} />
                <LockOpenBadge />
              </div>
              <span />
              <span />
            </div>
          );
      }
    })();

    return (
      <div className={"hidden sm:flex flex-col items-center relative px-1 pt-4 self-stretch"}>
        <div
          className="relative z-10"
          style={
            detached ? undefined : { backgroundColor: "var(--background)", boxShadow: "0 0 0 4px var(--background)" }
          }
        >
          {leadIn}
          {iconContent}
        </div>
        <div className="flex-1 relative">
          {spineEl}
          {isLast && !detached && <SpineTrailingMask />}
        </div>
      </div>
    );
  }

  // Token flow mode — 1 or 2 rows of token icons with directional arrows
  const rows = tokens ?? [];
  const hasBadge = rows.some((r) => r.badge);

  return (
    <div className={"hidden sm:flex flex-col items-center relative px-1 pt-4 self-stretch"}>
      <div
        className="relative z-10 flex flex-col gap-y-1 items-center"
        style={
          detached
            ? { paddingBottom: hasBadge ? 6 : 0 }
            : {
                backgroundColor: "var(--background)",
                boxShadow: "0 0 0 4px var(--background)",
                paddingBottom: hasBadge ? 6 : 0,
              }
        }
      >
        {leadIn}
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid items-center justify-items-center"
            style={{ gridTemplateColumns: scale.gridCols }}
          >
            <SpineVal
              value={showTimelineValues && row.direction === "left" ? row.value : undefined}
              side="left"
              onChange={row.direction === "left" ? row.onValueChange : undefined}
              decimals={row.valueDecimals}
              max={row.valueMax}
            />
            {row.direction === "left" ? <ArrowFromDot direction="left" size={scale.arrowSize} /> : <span />}
            {row.badge ? (
              <div className="relative">
                <TokenChipIcon symbol={row.symbol} address={row.address} size={scale.tokenSize} />
                {row.badge === "check" ? <CheckBadge size={scale.tokenSize} /> : <CrossBadge size={scale.tokenSize} />}
              </div>
            ) : (
              <TokenChipIcon symbol={row.symbol} address={row.address} size={scale.tokenSize} />
            )}
            {row.direction === "right" ? <ArrowFromDot direction="right" size={scale.arrowSize} /> : <span />}
            <SpineVal
              value={showTimelineValues && row.direction === "right" ? row.value : undefined}
              side="right"
              onChange={row.direction === "right" ? row.onValueChange : undefined}
              decimals={row.valueDecimals}
              max={row.valueMax}
            />
          </div>
        ))}
      </div>
      <div className="flex-1 relative">
        {spineEl}
        {isLast && !detached && <SpineTrailingMask />}
      </div>
    </div>
  );
}
