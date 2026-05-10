"use client";

import { useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { FloatingPanel } from "@/components/shared/floating-panel";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import type { CatalogAsset } from "@/lib/protocols/asset-catalog";

export interface AssetPickerProps {
  /** Assets eligible to be added on this side, with the catalog ones already
   *  in `excludeSymbols` filtered out by the caller. */
  options: CatalogAsset[];
  /** Symbols already represented in the simulator (base + added) — disabled
   *  in the list rather than hidden, so users see why an asset is missing. */
  excludeSymbols: ReadonlySet<string>;
  /** Side label — drives the trigger copy and asset hints. */
  side: "supply" | "borrow";
  /** Called with the chosen catalog asset when the user picks one. */
  onPick: (asset: CatalogAsset) => void;
  /** Optional small-text label below the trigger button. */
  hint?: string;
}

/** "+ Add supply / + Add borrow" trigger that opens a floating list of
 *  catalog assets. Used by simulator cards to let users model legs for
 *  assets the wallet doesn't currently hold. */
export function AssetPicker({ options, excludeSymbols, side, onPick, hint }: AssetPickerProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sideLabel = side === "supply" ? "Add supply" : "Add borrow";

  const filtered = options.filter(a => {
    if (excludeSymbols.has(a.symbol)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return a.symbol.toLowerCase().includes(q);
  });

  const handlePick = (a: CatalogAsset) => {
    onPick(a);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-rb-300/60 dark:border-rb-700/60 text-xs font-semibold text-rb-500 hover:text-foreground hover:border-blue-500 hover:bg-rb-100 dark:hover:bg-rb-900 transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{sideLabel}</span>
        {hint && <span className="text-[10px] font-normal text-rb-500">{hint}</span>}
      </button>

      <FloatingPanel
        anchor={open ? btnRef.current : null}
        onClose={() => { setOpen(false); setQuery(""); }}
        width={280}
        minSpaceBelow={300}
        closeOnScroll={false}
        align="start"
        ariaLabel={`Pick asset to ${side}`}
      >
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded bg-rb-100 dark:bg-rb-900 border border-rb-200 dark:border-rb-800">
            <Search className="w-3.5 h-3.5 text-rb-500" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs font-semibold focus:outline-none placeholder:text-rb-500"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-rb-500">No matching assets.</div>
          ) : (
            <div className="flex flex-col max-h-72 overflow-y-auto">
              {filtered.map(a => {
                const eligible = side === "supply" ? a.canSupply : a.canBorrow;
                const subParts: string[] = [];
                if (side === "supply") {
                  if (a.canCollateral && a.lt != null) subParts.push(`${(a.lt * 100).toFixed(0)}% LT`);
                  else subParts.push("yield only");
                }
                return (
                  <button
                    key={a.symbol}
                    type="button"
                    disabled={!eligible}
                    onClick={() => handlePick(a)}
                    className="group flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors hover:bg-rb-100 dark:hover:bg-rb-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer"
                  >
                    <TokenChipIcon symbol={a.symbol} size={20} filterable={false} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold truncate">{a.symbol}</span>
                      {subParts.length > 0 && (
                        <span className="text-[10px] text-rb-500 truncate">{subParts.join(" · ")}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </FloatingPanel>
    </>
  );
}
