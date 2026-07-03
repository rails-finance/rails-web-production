// Pendle Principal Tokens carry an on-chain ERC-20 symbol that omits the
// maturity (e.g. "PT-sUSDE"), but each maturity is a distinct token with
// distinct redemption mechanics. Aave's UI displays the augmented form
// (e.g. "PT-sUSDE-7MAY2026") — we do the same for parity.
//
// The lookup key is the on-chain symbol because that's what
// `AaveV4Context.reserveSymbol` carries; the maturity itself isn't on the
// wire. Refresh when Aave V4 lists a new PT maturity. If two maturities of
// the same underlying are ever listed simultaneously, we'd need to switch
// to address-keyed disambiguation — for now Aave lists one at a time.

export const PT_DISPLAY_LABELS: Record<string, string> = {
  "PT-sUSDE": "PT-sUSDE-7MAY2026",
};

export function aaveV4DisplaySymbol(symbol: string | null | undefined): string {
  if (!symbol) return symbol ?? "";
  return PT_DISPLAY_LABELS[symbol] ?? symbol;
}

// A Pendle PT's brand mark IS its underlying asset's logo — the maturity date
// is irrelevant to the icon, so every maturity of the same underlying shares
// one logo (PT-USDG-24SEP2026 and a hypothetical PT-USDG-24DEC2026 both show
// the USDG mark). Recover the underlying symbol by stripping the "PT-" prefix
// and any trailing "-<DAY><MON><YEAR>" maturity (the on-chain symbol carries
// the maturity for some listings — "PT-USDG-24SEP2026" — and omits it for
// others — bare "PT-sUSDE"; both reduce to the underlying). Returns null for
// non-PT symbols. Callers resolve the underlying symbol to an address/logo —
// keeping this maturity-agnostic means new PT listings need no icon wiring.
const PT_MATURITY_SUFFIX = /-\d{1,2}[A-Z]{3}\d{4}$/;
export function ptUnderlyingSymbol(symbol: string | null | undefined): string | null {
  if (!symbol || !symbol.startsWith("PT-")) return null;
  return symbol.slice(3).replace(PT_MATURITY_SUFFIX, "");
}

// The maturity date a PT carries in its symbol drives the Aave-style status ring
// on the icon: a PT is "active" until this date and "expired" (redeemable, no
// longer accruing PT yield) after it. We resolve the symbol through
// PT_DISPLAY_LABELS first so a bare on-chain "PT-sUSDE" inherits the maturity of
// its augmented form ("PT-sUSDE-7MAY2026"); a PT with no known maturity returns
// null (no ring). The date is UTC midnight — the calendar day is what matters,
// and callers compare it to the current time.
const PT_MATURITY_MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
const PT_MATURITY_RE = /-(\d{1,2})([A-Z]{3})(\d{4})$/;
export function ptMaturityDate(symbol: string | null | undefined): Date | null {
  if (!symbol) return null;
  const full = aaveV4DisplaySymbol(symbol);
  if (!full.startsWith("PT-")) return null;
  const m = full.match(PT_MATURITY_RE);
  if (!m) return null;
  const month = PT_MATURITY_MONTHS[m[2]];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}
