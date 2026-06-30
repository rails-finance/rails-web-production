import { TokenChipIcon } from "./token-chip-icon";
import type { HubTierKey } from "@/lib/api/fetch-aave-v4-hubs";

// Compact inline icon cluster for "value + icons" rows on position cards.
// All symbols render at a small fixed size with light overlap; the parent row
// uses flex-wrap so the cluster pushes to a new line if it crowds the value.
//
// Items may carry a `hub` (Core/Plus/Prime). A spoke can list the same asset
// under two hubs — two distinct reserves with the same symbol and the same
// icon — so when a hub is present we stamp a small corner badge (C/+/P) on the
// icon and a hover title, so the two otherwise-identical icons read as distinct.

export interface AssetClusterItem {
  symbol: string;
  /** Hub the reserve draws from; drives the corner badge. null/undefined →
   *  no badge (single-hub asset or hub not yet indexed). */
  hub?: HubTierKey | null;
}

export interface InlineAssetClusterProps {
  /** Plain symbols, or `{ symbol, hub }` items. Strings render with no badge. */
  symbols: (string | AssetClusterItem)[];
  size?: number;
  overlap?: number;
}

const HUB_BADGE: Record<HubTierKey, { char: string; label: string }> = {
  core: { char: "C", label: "Core Hub" },
  plus: { char: "+", label: "Plus Hub" },
  prime: { char: "P", label: "Prime Hub" },
};

function toItem(s: string | AssetClusterItem): AssetClusterItem {
  return typeof s === "string" ? { symbol: s } : s;
}

export function InlineAssetCluster({ symbols, size = 28, overlap = 9 }: InlineAssetClusterProps) {
  if (symbols.length === 0) return null;
  const items = symbols.map(toItem);
  return (
    <span className="inline-flex items-center">
      {items.map((item, i) => {
        const badge = item.hub ? HUB_BADGE[item.hub] : null;
        return (
          <span
            key={`${item.symbol}-${item.hub ?? ""}-${i}`}
            className="relative inline-flex items-center justify-center rounded-full bg-raised p-0.5"
            style={{ marginLeft: i > 0 ? -overlap : 0, zIndex: items.length - i }}
            title={badge ? `${item.symbol} · ${badge.label}` : undefined}
          >
            <TokenChipIcon symbol={item.symbol} size={size} filterable={false} />
            {badge && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-rb-500 font-semibold leading-none text-white ring-2 ring-[var(--background)]"
                style={{
                  width: Math.round(size * 0.5),
                  height: Math.round(size * 0.5),
                  fontSize: Math.round(size * 0.34),
                }}
              >
                {badge.char}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
