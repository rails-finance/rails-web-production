// Single source of truth for BOLD's USD value.
//
// BOLD is Liquity V2's debt unit. The protocol's redemption mechanism gives it
// a hard $1 floor — any holder can redeem 1 BOLD for $1 of collateral — so for
// display and P/L purposes we treat 1 BOLD = $1. The market price can drift
// slightly off peg, but there is no BOLD price feed wired into this frontend
// yet, so the value is pinned here as a named constant rather than scattered as
// a magic `1` across the price strip, the timeline spine anchors, and the
// redemption P/L math.
//
// Upgrade path (option B): the Aave side already resolves BOLD live via
// `resolvePrice()` (lib/aave/prices.ts) — it looks BOLD up by address in the
// DefiLlama-backed `/api/prices` map and only falls back to $1 when absent.
// To wire a live BOLD price into Liquity, replace `BOLD_USD_PEG` reads with a
// resolved price (fetched alongside the collateral oracle price on the trove
// page) and keep this constant as the fallback.
export const BOLD_USD_PEG = 1;

/** BOLD amount → its USD value under the current peg. A no-op multiply today
 * (peg = 1), but the one place to change when a live price lands. */
export function boldToUsd(boldAmount: number): number {
  return boldAmount * BOLD_USD_PEG;
}
