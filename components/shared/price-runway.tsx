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
 * The bar is three distinct pill-capped segments laid side-by-side on the card
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
 *   • **Ruler** — a "% from liquidation" axis: a gridline every 10%, 0% ON the
 *     liquidation line and the numbers climbing leftward into the safe runway.
 *     Same basis as the resting "% from liquidation" readout — (price − liq) /
 *     price — so the live-price marker lands on exactly the value the caption
 *     states and the two can't disagree. Brightest at the liquidation line (where
 *     the runway runs out) and fading as the runway lengthens off the left edge.
 *     Revealed only on hover, and only on hover-capable (desktop) pointers — touch /
 *     mobile never shows it, so the resting readouts can't be crowded there. The
 *     resting "% from liquidation" / "liquidation $" readouts stay put under the
 *     ruler (desktop has the width). The reveal waits a beat then fades up slowly.
 *
 * Positions safer than the window top (`offscreen`) sit off the left edge, where
 * a precise fill can't be drawn. Rather than vanish — leaving an apparently empty
 * track whose only occupant is the red zone — the marker clamps to the left edge
 * as a small blue nub (the collateral fill is off-scale that way); headroom then
 * runs from the nub to the liquidation line, fading out toward the nub so the
 * unbounded safe runway reads as continuing off-scale rather than hard-edged.
 * The "% from liquidation" number — with the price shown alongside — carries the
 * exact (and unbounded) upside the fixed window can't draw, so the clamped nub is
 * an honest "off this way" affordance, not a measurement.
 *
 * Underwater (live price at / below the liquidation line) the runway is spent,
 * so the whole bar flips to the factual-liquidation red: lighter red for the
 * now-out-of-reach prices above the line, the deep-red breach from the line to
 * the live-price marker, lighter red for any downside below it. The readouts
 * drop the headroom ruler and instead state "Liquidatable now" plus the price
 * rise needed to clear the line (`recoverPct`, denominated in the live price).
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
// At this bar height every segment is fully pill-capped (`rounded-full`) on all
// four corners — no per-corner caps to distinguish outer ends from internal
// seams, since a 10px-tall segment reads as rounded either way. The hairline
// gaps still draw the seams between segments.
const FILL = "bg-blue-500";
// Headroom is neutral but must stay legible on the dark card: the old
// `dark:bg-rb-700` (rgb 25 28 38) sat ~5 units off the rb-800 surface (rgb 20 22
// 30) and read as empty — fatal for offscreen rows where headroom is the bar's
// whole left ~83%. rb-500 (the brand blue-grey) at low alpha lifts it to a clear
// but subordinate neutral that doesn't compete with the blue fill.
const HEADROOM = "bg-rb-200 dark:bg-rb-500/30";
// Offscreen, the live price is >100% above liquidation and the true safe runway
// extends unbounded off the left edge. Fade the headroom out toward the nub
// (solid near the liquidation line → transparent toward the left) so the bar
// reads as "runway continues off-scale this way" rather than a hard-edged fill.
const HEADROOM_OFFSCREEN = "bg-gradient-to-l from-rb-200 to-transparent dark:from-rb-500/30";
const LIQ = "bg-red-400/60 dark:bg-red-500/40";
const LIQ_ACTIVE = "bg-red-500 dark:bg-red-500";
const H_BAR = 10; // bar height in px (h-2.5)
const SEG_GAP_PX = 1; // hairline gap between adjacent segments

// Window bounds as multiples of the liquidation price.
const WINDOW_TOP_MULT = 2.0; // left edge — 100% above liquidation
const WINDOW_BOTTOM_MULT = 0.8; // right edge — 20% below liquidation
const RULER_MAX_PCT = 50; // last labelled increment
const RULER_FADE_DENOM = 60; // opacity = 1 − pct/denom; >MAX so 50% stays faintly visible
const OFFSCREEN_STUB = 5; // width (% of window) of the pinned blue nub when the live price is offscreen

export interface PriceRunwayProps {
  currentPrice: number;
  liqPrice: number | null;
  /** Overrides the right-side caption when safe (default `liquidation $<price>`).
   *  Lets a non-price axis (e.g. an Aave health-factor runway, where the value
   *  is HF and the line is HF 1.0) label the threshold in its own units. */
  liqCaption?: React.ReactNode;
  /** Overrides the right-side caption when underwater (default
   *  `recovers at $<price> (+N%)`). */
  underwaterCaption?: React.ReactNode;
}

export function PriceRunway({ currentPrice, liqPrice, liqCaption, underwaterCaption }: PriceRunwayProps) {
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
  // Distance to liquidation as a share of the LIVE price — (current − liq) /
  // current — so this readout matches each rail's "% headroom" stat exactly
  // (Aave's spoke-card header, Liquity's OpenSummaryCard) instead of dividing by
  // the liq price and disagreeing with it (a 19% headroom vs a 24% runway for
  // the same gap). It also shares the live-price basis the recoverPct already uses.
  const pctFromLiq = Math.round(((currentPrice - liqPrice!) / currentPrice) * 100);
  // Once underwater the runway is spent — the only figure that matters is how
  // far the price must RISE to clear liquidation, denominated in the live price
  // (not the liq price). E.g. $7.81 vs a $9.30 line → +19% to recover.
  const recoverPct = underwater ? Math.round(((liqPrice! - currentPrice) / currentPrice) * 100) : 0;

  // Segment extents (% from left). Blue never extends past the liquidation line;
  // headroom is the gap between the live-price marker and that line (zero once
  // the price is at / inside the zone). Red runs from the line to the right edge.
  // Offscreen, the fill clamps to a fixed nub at the left edge and headroom takes
  // the rest up to the line — so the row shows a marker + headroom + zone like any
  // other, instead of an all-headroom (and so apparently empty) track.
  const fillEnd = offscreen ? OFFSCREEN_STUB : Math.min(fillPct, liqPos);
  const headroomW = Math.max(0, liqPos - fillEnd);

  // A "% from liquidation" axis in the SAME basis as the readout — each tick is
  // the % a price sits above the liquidation line, (p − liq) / p — with 0% ON the
  // liquidation line and the numbers climbing LEFTWARD into the safe runway. So
  // the live-price marker lands on exactly the "X% from liquidation" the resting
  // caption states (the two can't disagree), instead of the inverse "% drop from
  // today" reading whose big numbers pointed at the red. Brightest at the
  // liquidation line — where the runway runs out — and fading as the runway
  // lengthens. Ticks past the window's left edge are dropped, not clamped.
  const rulerTicks = [];
  for (let n = 0; n <= RULER_MAX_PCT; n += 10) {
    const price = liqPrice! / (1 - n / 100); // (price − liq) / price = n/100
    const raw = ((windowTop - price) / range) * 100;
    if (raw < 0 || raw > 100) continue;
    rulerTicks.push({
      pct: n,
      pos: raw,
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
        {underwater ? (
          // Underwater: the runway is gone, so the whole bar reads in the
          // factual-liquidation red (the one sanctioned colour). The hairline
          // seam at the liquidation line keeps the breach legible: prices above
          // the line — now out of reach — sit in lighter red on the left; the
          // deep-red breach runs from the line to the live-price marker (its
          // rounded cap), with any remaining downside trailing in lighter red.
          <>
            {liqPos > 0 && <div className={`${LIQ} rounded-full`} style={{ flexGrow: liqPos, flexBasis: 0 }} />}
            <div
              className={`${LIQ_ACTIVE} rounded-full`}
              style={{ flexGrow: Math.max(0.5, fillPct - liqPos), flexBasis: 0 }}
            />
            {fillPct < 100 && (
              <div className={`${LIQ} rounded-full`} style={{ flexGrow: 100 - fillPct, flexBasis: 0 }} />
            )}
          </>
        ) : (
          <>
            {/* Collateral fill — window top → live price. Its rounded right cap
                is the live-price marker. Offscreen, it's the clamped left-edge nub
                (OFFSCREEN_STUB wide) marking "off-scale this way". */}
            {fillEnd > 0 && <div className={`${FILL} rounded-full`} style={{ flexGrow: fillEnd, flexBasis: 0 }} />}
            {/* Headroom — live price → liquidation line. The neutral distance the
                price can still fall; absent once at / inside the zone. */}
            {headroomW > 0 && (
              <div
                className={`${offscreen ? HEADROOM_OFFSCREEN : HEADROOM} rounded-full`}
                style={{ flexGrow: headroomW, flexBasis: 0 }}
              />
            )}
            {/* Liquidation zone — from the liquidation line to the right edge. */}
            <div className={`${LIQ} rounded-full`} style={{ flexGrow: 100 - liqPos, flexBasis: 0 }} />
          </>
        )}
      </div>

      {/* Label strip: the resting "% from liquidation" + "liquidation $" readouts
          stay put; on hover (desktop) the faded % ruler reveals across the same row. */}
      <div className="relative mt-2 h-4 text-[11px] tabular-nums text-rb-500">
        {underwater ? (
          // Past the liquidation line the "% from liquidation" ruler is
          // meaningless — replace it with the factual state and the rise the
          // price needs to clear the line.
          <>
            <span className="absolute left-0 font-semibold text-red-600 dark:text-red-400">Liquidatable now</span>
            <span className="absolute right-0">
              {underwaterCaption ?? <>recovers at {fmtPrice(liqPrice!)} (+{recoverPct}%)</>}
            </span>
          </>
        ) : (
          <>
            <span className="absolute left-0">{pctFromLiq}% from liquidation</span>
            <span className="absolute right-0">{liqCaption ?? <>liquidation {fmtPrice(liqPrice!)}</>}</span>
            <div className={`pointer-events-none absolute inset-0 ${REVEAL}`}>
              {rulerTicks.map((t) => (
                <span
                  key={t.pct}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${t.pos}%`, opacity: t.opacity }}
                >
                  {t.pct}%
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
