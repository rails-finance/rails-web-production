"use client";

// Fixed bottom strip showing current USD prices for the assets relevant to the
// position in view. Liquity troves carry two (collateral + BOLD); Aave spokes
// carry one row per supplied/borrowed reserve, so the strip scrolls
// horizontally when an asset-heavy spoke overflows.
//
// The strip is `fixed` to the viewport, so when scrolled to the bottom it
// overlays the AppFooter. A tiny context lets the footer learn a strip is
// mounted (counter, not boolean — survives StrictMode's double-invoke and
// multiple strips) and pad its bottom so its content clears the strip. The
// API context exposes only a stable setter so the strip's register effect
// never re-fires on active-state changes; the footer reads the boolean from a
// separate context.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PricePill } from "@/components/shared/price-pill";

const PriceStripApiContext = createContext<((active: boolean) => void) | null>(null);
const PriceStripActiveContext = createContext<boolean>(false);

export function PriceStripProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const setActive = useCallback((active: boolean) => {
    setCount((c) => Math.max(0, c + (active ? 1 : -1)));
  }, []);
  return (
    <PriceStripApiContext.Provider value={setActive}>
      <PriceStripActiveContext.Provider value={count > 0}>{children}</PriceStripActiveContext.Provider>
    </PriceStripApiContext.Provider>
  );
}

/** True while a PriceStrip is mounted — the footer uses this to pad clear. */
export function usePriceStripActive(): boolean {
  return useContext(PriceStripActiveContext);
}

export interface PriceStripAsset {
  symbol: string;
  address?: string;
  price: number;
}

export function PriceStrip({ assets }: { assets: PriceStripAsset[] }) {
  const setActive = useContext(PriceStripApiContext);
  const present = assets.length > 0;

  useEffect(() => {
    if (!setActive || !present) return;
    setActive(true);
    return () => setActive(false);
  }, [setActive, present]);

  if (!present) return null;

  return (
    // Compact, right-aligned cluster — hugs its content rather than spanning
    // the viewport. Caps at the viewport width and scrolls for asset-heavy
    // spokes. Each pill drops its symbol label; the tooltip names the asset.
    <div className="fixed bottom-3 right-3 md:right-4 z-30 max-w-[calc(100vw-1.5rem)] overflow-x-auto rounded-lg bg-white dark:bg-rb-900 shadow-lg">
      <div className="flex items-center gap-2 px-2 py-2">
        {assets.map((a) => (
          <PricePill
            key={a.symbol}
            symbol={a.symbol}
            address={a.address}
            price={a.price}
            filterable={false}
            title={a.symbol}
            bare
          />
        ))}
      </div>
    </div>
  );
}
