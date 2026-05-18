// Tiny family pill: "Lend" for OneWayLending markets, "crvUSD" for the
// crvUSD mint markets. Used inline in the position-card identity column.
//
// Structural prop type so this file has zero dependencies — the pill only
// reads `info.family`. Other modules import it where the LlamalendPosition
// type is in scope.

export function MarketPill({ info }: { info: { family: "lend" | "mint" } }) {
  return (
    <span className="px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs uppercase tracking-wide font-semibold">
      {info.family === "mint" ? "crvUSD" : "Lend"}
    </span>
  );
}
