import { TokenChipIcon } from "./token-chip-icon";

// Compact inline icon cluster for "value + icons" rows on position cards.
// All symbols render at a small fixed size with light overlap; the parent row
// uses flex-wrap so the cluster pushes to a new line if it crowds the value.

export interface InlineAssetClusterProps {
  symbols: string[];
  size?: number;
  overlap?: number;
}

export function InlineAssetCluster({ symbols, size = 32, overlap = 9 }: InlineAssetClusterProps) {
  if (symbols.length === 0) return null;
  return (
    <span className="inline-flex items-center">
      {symbols.map((sym, i) => (
        <span
          key={`${sym}-${i}`}
          className="relative inline-flex items-center justify-center rounded-full bg-rb-50 dark:bg-rb-800 p-0.5"
          style={{ marginLeft: i > 0 ? -overlap : 0, zIndex: symbols.length - i }}
        >
          <TokenChipIcon symbol={sym} size={size} filterable={false} />
        </span>
      ))}
    </span>
  );
}
