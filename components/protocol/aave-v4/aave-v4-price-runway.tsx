"use client";

import { fmtPrice } from "@/components/shared/price-pill";

/**
 * Per-asset price runway for an Aave V4 spoke.
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
 * What reads off the bar:
 *   • **Neutral fill** — from the left edge to the current price; its rounded
 *     cap is the live-price marker. As price falls, the cap slides right toward
 *     the red. The price itself is labelled in the row's meta column, not on the
 *     bar — nothing is drawn twice.
 *   • **Liquidation zone** — red, from the liquidation price to the right edge.
 *     The one deliberate colour: being at/below the liquidation price is a hard
 *     on-chain fact, not an opinion. It deepens once the live price is in it.
 *   • **Ruler** — a dot + "% from liquidation" label every 10%, fading out
 *     toward the safe side (crisp at 0% / the liquidation line, faintest at 50%);
 *     the fade echoes the unbounded — and so un-drawable — safe upside. Revealed
 *     only on hover, and only on hover-capable (desktop) pointers — touch /
 *     mobile never shows it, so the resting readouts can't be crowded there. The
 *     resting "% from liquidation" / "liquidation $" readouts stay put under the
 *     ruler (desktop has the width). The reveal waits a beat then fades up slowly.
 *
 * Positions safer than the window top (`offscreen`) leave the bar empty; the
 * "% from liquidation" number — with the price in the row label — carries the
 * magnitude. That empty bar is the honest picture of an unbounded upside.
 *
 * Everything else stays uneditorialised (no safe/caution colour gradient) per
 * the no-opinionated-colour principle; the numbers around the bar state the
 * facts. Read-only — renders current oracle-derived state.
 */

// Neutral track + fill; red reserved for the liquidation zone (see above). The
// track is a rounded-full pill; the inner fill/red bars use a small radius so
// their caps read as crisp markers rather than pill ends.
const TRACK = "bg-rb-100 dark:bg-rb-900";
const FILL = "bg-rb-300 dark:bg-rb-600";
const LIQ = "bg-red-400/60 dark:bg-red-500/40";
const LIQ_ACTIVE = "bg-red-500 dark:bg-red-500";
const INNER_RADIUS = "rounded-sm"; // smaller than the track's rounded-full

// Window bounds as multiples of the liquidation price.
const WINDOW_TOP_MULT = 2.0; // left edge — 100% above liquidation
const WINDOW_BOTTOM_MULT = 0.8; // right edge — 20% below liquidation
const RULER_MAX_PCT = 50; // last labelled increment
const RULER_FADE_DENOM = 60; // opacity = 1 − pct/denom; >MAX so 50% stays faintly visible

export interface AaveV4PriceRunwayProps {
  currentPrice: number;
  liqPrice: number | null;
}

export function AaveV4PriceRunway({ currentPrice, liqPrice }: AaveV4PriceRunwayProps) {
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

  // Ruler increments, fading out toward the safe side (50% stays faintly visible).
  const rulerTicks = [];
  for (let n = 0; n <= RULER_MAX_PCT; n += 10) {
    rulerTicks.push({ pct: n, pos: posFromLeft(liqPrice! * (1 + n / 100)), opacity: Math.max(0, 1 - n / RULER_FADE_DENOM) });
  }

  const H_BAR = 20;

  // Ruler reveal: hidden at rest; fades up after a short delay over a slow
  // duration, but only on hover-capable pointers AND wide enough viewports — the
  // `(hover: hover)` gate keeps it off touch / mobile, and the `min-width` gate
  // keeps the labels from colliding with the readouts on narrow runways.
  const REVEAL =
    "opacity-0 transition-opacity duration-500 [@media(hover:hover)_and_(min-width:1024px)]:group-hover/runway:opacity-100 [@media(hover:hover)_and_(min-width:1024px)]:group-hover/runway:delay-200";

  return (
    <div className="group/runway relative" style={{ paddingTop: 6 }}>
      <div className="relative" style={{ height: H_BAR }}>
        {/* Track (rounded-full pill) holding the small-radius fill + red zone */}
        <div className={`absolute inset-0 overflow-hidden rounded-full ${TRACK}`}>
          <div className={`absolute bottom-0 left-0 top-0 ${INNER_RADIUS} ${FILL}`} style={{ width: `${fillPct}%` }} />
          {/* Liquidation zone — its left edge is a straight vertical line sitting
              exactly at the liquidation price (and so at the 0% ruler dot). Only the
              right corners are rounded (they tuck into the track's pill anyway); the
              left stays square so the boundary reads as a crisp threshold. */}
          <div
            className={`absolute bottom-0 right-0 top-0 rounded-r-sm transition-colors ${underwater ? LIQ_ACTIVE : LIQ}`}
            style={{ left: `${liqPos}%` }}
          />
        </div>

        {/* Ruler dots — hover only, aligned to the bottom of the bar, fading toward safe */}
        <div className={`pointer-events-none absolute inset-0 ${REVEAL}`}>
          {rulerTicks.map((t) => (
            <span
              key={t.pct}
              className="absolute bottom-0 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-foreground/40"
              style={{ left: `${t.pos}%`, opacity: t.opacity }}
            />
          ))}
        </div>
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

/**
 * Plain-language explanation for one collateral asset's runway. Lives on the
 * economics card's standard bottom-left (i) disclosure rather than inline on
 * the bar, so help has a single consistent home. Recomputes the same
 * underwater / over-covered / headroom states the bar visualises.
 */
export function aaveV4RunwayExplanation({
  collateralSymbol,
  currentPrice,
  liqPrice,
}: {
  collateralSymbol: string;
  currentPrice: number;
  liqPrice: number | null;
}): React.ReactNode {
  const hasLiq = liqPrice != null && liqPrice > 0;
  const underwater = hasLiq && currentPrice <= liqPrice!;
  const overCovered = liqPrice === 0;
  const headroomPct = hasLiq && currentPrice > 0 ? ((currentPrice - liqPrice!) / currentPrice) * 100 : null;

  if (underwater) {
    return (
      <>
        <span className="font-semibold text-foreground">{collateralSymbol} is below its liquidation price.</span>{" "}
        On-chain, this position would be liquidatable.
      </>
    );
  }
  if (overCovered) {
    return (
      <>
        The rest of the collateral already covers this spoke&apos;s debt — {collateralSymbol} can fall to zero without
        tripping a liquidation (other assets would need to fall too).
      </>
    );
  }
  if (hasLiq && headroomPct != null) {
    return (
      <>
        {collateralSymbol} would need to drop{" "}
        <span className="font-semibold text-foreground">{headroomPct.toFixed(1)}%</span> (to {fmtPrice(liqPrice!)})
        before this spoke&apos;s health factor reaches 1 — holding every other asset at its current state.
      </>
    );
  }
  return <>No debt on this spoke, so there&apos;s no liquidation price to plot.</>;
}
