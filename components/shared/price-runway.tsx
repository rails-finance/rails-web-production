"use client";

import { fmtPrice } from "@/components/shared/price-pill";

/**
 * Price runway for a single collateral asset — shared across rails (an Aave V4
 * reserve, a Liquity V2 trove's collateral). Given a current price and the
 * price at which the position becomes liquidatable, it draws how much room the
 * price has left to fall.
 *
 * The bar is a price axis anchored on the liquidation price: it spans from
 * `2 × liqPrice` (left, 100% above liquidation) down to `0.8 × liqPrice` (right,
 * 20% under water — a realistic floor, since liquidators close a position near
 * its liquidation price rather than letting it sink arbitrarily far). Because
 * the window is a fixed *multiple* of the liquidation price, the liquidation
 * line lands at the SAME horizontal position on every row — so a 9%-from-liq
 * asset visibly sits closer to the red than a 24% one, and the rows stay
 * comparable without any single shared scale.
 *
 * The bar is three distinct rounded segments laid side-by-side on the card
 * surface (not painted inside a recessed track), separated by hairline gaps.
 * What reads off it:
 *   • **Collateral fill** — collateral-blue (the tower chart's structural
 *     collateral colour, an identity cue rather than risk valence), from the
 *     left edge to the current price; its rounded cap is the live-price marker.
 *     As price falls, the cap slides right toward the red. The price itself is
 *     labelled alongside the bar, not on it — nothing is drawn twice.
 *   • **Headroom** — a neutral segment from the live-price marker to the
 *     liquidation line: the distance the price can still fall. Zero-width once
 *     the price is at / inside the liquidation zone.
 *   • **Liquidation zone** — red, from the liquidation price to the right edge.
 *     The one deliberate colour: being at/below the liquidation price is a hard
 *     on-chain fact, not an opinion. It deepens once the live price is in it.
 *   • **Ruler** — a "% from liquidation" label every 10%, fading out
 *     toward the safe side (crisp at 0% / the liquidation line, faintest at 50%);
 *     the fade echoes the unbounded — and so un-drawable — safe upside. Revealed
 *     only on hover, and only on hover-capable (desktop) pointers — touch /
 *     mobile never shows it, so the resting readouts can't be crowded there. The
 *     resting "% from liquidation" / "liquidation $" readouts stay put under the
 *     ruler (desktop has the width). The reveal waits a beat then fades up slowly.
 *
 * Positions safer than the window top (`offscreen`) push the live-price marker
 * off the left edge, so the bar is all headroom up to the liquidation line; the
 * "% from liquidation" number — with the price shown alongside — carries the
 * exact (and unbounded) upside the fixed window can't draw.
 *
 * No safe/caution gradient (per the no-opinionated-colour principle): blue is a
 * structural collateral cue, red is the one factual liquidation colour, and the
 * numbers around the bar state the rest. Read-only — current oracle state.
 */

// The bar is built from distinct rounded segments laid directly on the card
// surface — not painted inside a recessed track (which read as the bars sinking
// into a dark well in dark mode). Three segments, separated by hairline gaps:
//   • FILL     — collateral-blue, window top → live price. Same structural
//                collateral colour as the tower chart: identity, not risk
//                valence (red stays the only valence colour).
//   • HEADROOM — neutral, live price → liquidation line (how far it can fall).
//   • LIQ      — red liquidation zone, beyond the liquidation line.
// Only the two OUTER ends of the whole bar are pill caps (the left end of the
// leftmost segment, the right end of the liquidation zone); every internal
// segment-to-segment edge gets a small radius so the gaps read as crisp seams
// rather than a string of pills. Radii are inline border-radius shorthand.
//
// R_FULL is exactly HALF the bar height — NOT a huge value like 9999px. An
// oversized radius on one corner makes the browser scale *every* corner of that
// element down by the same factor (the CSS corner-overlap rule), which silently
// flattened the R_SM corners on the same element to ~0 (square). A half-height
// radius caps the end as a clean semicircle while leaving the small corners
// intact.
const FILL = "bg-blue-500";
const HEADROOM = "bg-rb-200 dark:bg-rb-700";
const LIQ = "bg-red-400/60 dark:bg-red-500/40";
const LIQ_ACTIVE = "bg-red-500 dark:bg-red-500";
const H_BAR = 20; // bar height in px
const SEG_GAP_PX = 1; // hairline gap between adjacent segments
const R_SM = "4px"; // internal segment-to-segment corners
const R_FULL = `${H_BAR / 2}px`; // outer end caps = half height → semicircle, no down-scaling
// border-radius shorthand order: top-left, top-right, bottom-right, bottom-left.
const CAP_LEFT = `${R_FULL} ${R_SM} ${R_SM} ${R_FULL}`; // left end capped, right small
const CAP_RIGHT = `${R_SM} ${R_FULL} ${R_FULL} ${R_SM}`; // right end capped, left small

// Window bounds as multiples of the liquidation price.
const WINDOW_TOP_MULT = 2.0; // left edge — 100% above liquidation
const WINDOW_BOTTOM_MULT = 0.8; // right edge — 20% below liquidation
const RULER_MAX_PCT = 50; // last labelled increment
const RULER_FADE_DENOM = 60; // opacity = 1 − pct/denom; >MAX so 50% stays faintly visible

export interface PriceRunwayProps {
  currentPrice: number;
  liqPrice: number | null;
}

export function PriceRunway({ currentPrice, liqPrice }: PriceRunwayProps) {
  const hasLiq = liqPrice != null && liqPrice > 0;
  if (!hasLiq) return null; // no debt / fully covered — nothing to plot

  // Geometry: left = high/safe price, right = low price (toward & past liq).
  const windowTop = liqPrice! * WINDOW_TOP_MULT;
  const windowBottom = liqPrice! * WINDOW_BOTTOM_MULT;
  const range = windowTop - windowBottom;
  const posFromLeft = (p: number) => Math.max(0, Math.min(100, ((windowTop - p) / range) * 100));

  const liqPos = posFromLeft(liqPrice!); // constant across every row
  const offscreen = currentPrice > windowTop;
  const fillPct = offscreen ? 0 : posFromLeft(currentPrice);
  const underwater = currentPrice <= liqPrice!;
  const pctFromLiq = Math.round(((currentPrice - liqPrice!) / liqPrice!) * 100);

  // Segment extents (% from left). Blue never extends past the liquidation line;
  // headroom is the gap between the live-price marker and that line (zero once
  // the price is at / inside the zone). Red runs from the line to the right edge.
  const fillEnd = Math.min(fillPct, liqPos);
  const headroomW = Math.max(0, liqPos - fillPct);

  // Ruler increments, fading out toward the safe side (50% stays faintly visible).
  const rulerTicks = [];
  for (let n = 0; n <= RULER_MAX_PCT; n += 10) {
    rulerTicks.push({
      pct: n,
      pos: posFromLeft(liqPrice! * (1 + n / 100)),
      opacity: Math.max(0, 1 - n / RULER_FADE_DENOM),
    });
  }

  // Ruler reveal: hidden at rest; fades up after a short delay over a slow
  // duration, but only on hover-capable pointers AND wide enough viewports — the
  // `(hover: hover)` gate keeps it off touch / mobile, and the `min-width` gate
  // keeps the labels from colliding with the readouts on narrow runways.
  const REVEAL =
    "opacity-0 transition-opacity duration-500 [@media(hover:hover)_and_(min-width:1024px)]:group-hover/runway:opacity-100 [@media(hover:hover)_and_(min-width:1024px)]:group-hover/runway:delay-200";

  return (
    <div className="group/runway relative" style={{ paddingTop: 6 }}>
      {/* Flow segments laid side-by-side: each is a flex child grown by its
          share of the price window, the flex gap drawing the hairline seams.
          Widths are proportional, not pixel-exact — close enough to read. */}
      <div className="flex" style={{ height: H_BAR, gap: SEG_GAP_PX }}>
        {/* Collateral fill — window top → live price. Left end caps the bar;
            right end is the internal live-price marker (small radius). */}
        {fillEnd > 0 && <div className={FILL} style={{ flexGrow: fillEnd, flexBasis: 0, borderRadius: CAP_LEFT }} />}
        {/* Headroom — live price → liquidation line. The neutral distance the
            price can still fall; absent once at / inside the zone. Caps the bar's
            left end only when no blue fill precedes it (price above the window);
            otherwise both edges are internal (small radius). */}
        {headroomW > 0 && (
          <div
            className={HEADROOM}
            style={{ flexGrow: headroomW, flexBasis: 0, borderRadius: fillEnd > 0 ? R_SM : CAP_LEFT }}
          />
        )}
        {/* Liquidation zone — from the liquidation line to the right edge. Left
            edge internal (small radius); right end caps the bar. Deepens once the
            live price is inside it. */}
        <div
          className={`transition-colors ${underwater ? LIQ_ACTIVE : LIQ}`}
          style={{ flexGrow: 100 - liqPos, flexBasis: 0, borderRadius: CAP_RIGHT }}
        />
      </div>

      {/* Label strip: the resting "% from liquidation" + "liquidation $" readouts
          stay put; on hover (desktop) the faded % ruler reveals across the same row. */}
      <div className="relative mt-2 h-4 text-[11px] tabular-nums text-rb-500">
        <span className="absolute left-0">{pctFromLiq}% from liquidation</span>
        <span className="absolute right-0">liquidation {fmtPrice(liqPrice!)}</span>
        <div className={`pointer-events-none absolute inset-0 ${REVEAL}`}>
          {rulerTicks.map((t) => (
            <span key={t.pct} className="absolute -translate-x-1/2" style={{ left: `${t.pos}%`, opacity: t.opacity }}>
              {t.pct}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
