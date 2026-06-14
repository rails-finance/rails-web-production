"use client";

// One column of the cross-hub comparison surface (/aave-v4/hubs). Renders a
// single hub's identity, size, composition, per-asset breakdown and spoke
// summary. Strictly descriptive — present, don't rank (see
// migration/aave-v4-hub-comparison.md):
//   * Hub name uses the existing categorical HUB_COLORS chip (identity, not
//     valence) — same treatment as the spoke header badge.
//   * Everything else is neutral foreground/rb tones. Utilisation bars use a
//     single neutral fill (no red-at-high), and the composition bar steps
//     opacity, never a risk palette.

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { HUB_COLORS, type HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import { fmtUsd } from "@/lib/aave-v4/format";
import { hubSummaryText, type HubView, type HubAssetAgg } from "@/lib/aave-v4/hub-view";

const HUB_TIER_LABEL: Record<string, HubTier> = { core: "Core", plus: "Plus", prime: "Prime" };

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// Rates carry two decimals — a borrow/supply APR of 3.71% shouldn't round to 4%.
function ratePct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

function ltDisplay(a: HubAssetAgg): string {
  if (a.ltMin == null || a.ltMax == null) return "—";
  if (Math.abs(a.ltMin - a.ltMax) < 0.0001) return a.ltMin.toFixed(2);
  return `${a.ltMin.toFixed(2)}–${a.ltMax.toFixed(2)}`;
}

// Neutral utilisation bar — a ratio, not a verdict. Clamped to 100% fill.
function UtilBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[11px] text-rb-500">uncapped</span>;
  }
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-foreground/50" style={{ width: `${clamped * 100}%` }} />
      </div>
      <span className="tabular-nums text-[11px] text-rb-500">{pct(value)}</span>
    </div>
  );
}

// Composition bar: stepped opacity per class so it reads as proportion, not
// risk. Labels below carry the class names.
const CLASS_OPACITY = ["bg-foreground/70", "bg-foreground/50", "bg-foreground/35", "bg-foreground/20", "bg-foreground/10"];

function CompositionBar({ composition }: { composition: HubView["composition"] }) {
  if (composition.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-foreground/5">
        {composition.map((c, i) => (
          <div key={c.cls} className={CLASS_OPACITY[i] ?? "bg-foreground/10"} style={{ width: `${c.pct}%` }} title={`${c.pct}% ${c.label}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-rb-500">
        {composition.map((c) => (
          <span key={c.cls} className="tabular-nums">
            {c.pct}% {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AaveV4HubColumn({ hub }: { hub: HubView }) {
  const supplied = fmtUsd(hub.suppliedUsd);
  const borrowed = fmtUsd(hub.borrowedUsd);
  const tier = HUB_TIER_LABEL[hub.hub];
  const tierColor = HUB_COLORS[tier];
  const summary = hubSummaryText(hub);

  return (
    <div className="flex flex-col rounded-lg border border-rb-200 dark:border-rb-800 bg-raised p-5">
      {/* Identity */}
      <div className="mb-4">
        <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${tierColor.bg} ${tierColor.text}`}>
          {hub.label}
        </span>
        <p className="mt-2 text-[13px] leading-relaxed text-rb-500">{hub.purpose}</p>
      </div>

      {/* Size */}
      <dl className="mb-4 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-rb-500">Supplied</dt>
          <dd className="tabular-nums text-base font-semibold text-foreground" title={supplied.title}>
            {supplied.display}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-rb-500">Borrowed</dt>
          <dd className="tabular-nums text-base font-semibold text-foreground" title={borrowed.title}>
            {borrowed.display}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-rb-500">Positions</dt>
          <dd className="tabular-nums text-base font-semibold text-foreground">
            {hub.positionCount.toLocaleString()}
          </dd>
        </div>
      </dl>

      {/* Composition */}
      {hub.composition.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-rb-500">Supply mix</div>
          <CompositionBar composition={hub.composition} />
          {summary && <p className="mt-2 text-[12px] leading-relaxed text-rb-500">{summary}</p>}
        </div>
      )}

      {/* Assets */}
      <div className="mb-4 flex-1">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-rb-500">Assets</div>
        <ul className="space-y-2.5">
          {hub.assets.map((a) => {
            const sUsd = fmtUsd(a.suppliedUsd);
            const bUsd = fmtUsd(a.borrowedUsd);
            return (
              <li key={a.symbol} className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <TokenChipIcon symbol={a.symbol} address={a.underlying} size={20} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-foreground">{a.symbol}</span>
                      {a.anyHalted && (
                        <span className="rounded bg-foreground/10 px-1 text-[10px] uppercase tracking-wide text-rb-500">
                          halted
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-rb-500">
                      LT {ltDisplay(a)}
                      {a.supplyApr != null && a.supplyApr > 0 && (
                        <span title="Supplier yield: borrow rate × utilisation × (1 − liquidity fee)">
                          {" "}· supply {ratePct(a.supplyApr)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular-nums text-[13px] text-foreground" title={`Supplied ${sUsd.title}`}>
                    {sUsd.display}
                  </div>
                  <div className="tabular-nums text-[11px] text-rb-500" title={`Borrowed ${bUsd.title}`}>
                    borrowed {bUsd.display}
                    {a.borrowApr != null && a.borrowedUsd > 0 && (
                      <span title="Current variable borrow rate (the hub's drawnRate)"> · {ratePct(a.borrowApr)}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex justify-end" title="Credit-line utilisation (drawn ÷ draw cap)">
                    <UtilBar value={a.drawUtil} />
                  </div>
                </div>
              </li>
            );
          })}
          {hub.assets.length === 0 && <li className="text-[13px] text-rb-500">No assets listed.</li>}
        </ul>
      </div>

      {/* Spokes summary */}
      <div className="mt-auto border-t border-rb-200 dark:border-rb-800 pt-3 text-[12px] text-rb-500">
        <span className="text-foreground/80">{hub.spokeNames.length}</span>{" "}
        {hub.spokeNames.length === 1 ? "spoke" : "spokes"}
        {hub.haltedSpokes.length > 0 && <> · {hub.haltedSpokes.length} halted</>}
        <div className="mt-1 truncate" title={hub.spokeNames.join(", ")}>
          {hub.spokeNames.join(", ")}
        </div>
      </div>
    </div>
  );
}
