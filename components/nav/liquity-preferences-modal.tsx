"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "@/lib/shared/preferences-context";
import { DEFAULT_LIQUITY_V2_PREFERENCES } from "@/lib/shared/preferences";

/**
 * Fullscreen modal for Liquity V2 preferences.
 *
 * Today this surfaces the risk-zone CR thresholds — Conservative and Moderate
 * minimums — which drive both the price-runway widget's segment colours and
 * the timeline's CR colour. Liquidation is fixed by each branch's MCR (110%
 * on WETH, 120% on wstETH/rETH) and is not user-editable. The thresholds
 * apply across all branches, so they must sit safely above the highest MCR
 * in the protocol. The shell is intentionally roomy so future Liquity-V2-
 * specific preferences (default redemption-risk view, batch-manager filters,
 * etc.) can land here without rebuilding the surface.
 */

// Highest MCR in the protocol (wstETH/rETH branches use 120%). User-editable
// thresholds must clear this so the boundary is meaningful for every branch.
const MIN_THRESHOLD_FLOOR = 121;

export function LiquityPreferencesModal({ onClose }: { onClose: () => void }) {
  const { prefs, update } = usePreferences();
  const v2 = prefs.liquityV2;

  // Esc closes; body scroll locked while open so the backdrop stays glued.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const setThreshold = (key: "crConservativeMin" | "crModerateMin", value: number) => {
    if (!isFinite(value)) return;
    // Keep ordering invariant: Conservative ≥ Moderate ≥ MCR (110). If the user
    // pushes one threshold past the other, slide the neighbour to maintain a
    // valid gradient instead of letting the zones invert.
    let { crConservativeMin, crModerateMin } = v2;
    if (key === "crConservativeMin") {
      crConservativeMin = Math.max(MIN_THRESHOLD_FLOOR, value);
      if (crConservativeMin <= crModerateMin) crModerateMin = Math.max(MIN_THRESHOLD_FLOOR, crConservativeMin - 10);
    } else {
      crModerateMin = Math.max(MIN_THRESHOLD_FLOOR, value);
      if (crModerateMin >= crConservativeMin) crConservativeMin = crModerateMin + 10;
    }
    update({ liquityV2: { crConservativeMin, crModerateMin } });
  };

  const reset = () => update({ liquityV2: DEFAULT_LIQUITY_V2_PREFERENCES });
  const isDefault =
    v2.crConservativeMin === DEFAULT_LIQUITY_V2_PREFERENCES.crConservativeMin &&
    v2.crModerateMin === DEFAULT_LIQUITY_V2_PREFERENCES.crModerateMin;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto" onClick={onClose}>
      <div
        className="fixed inset-0 backdrop-blur-sm pointer-events-none"
        style={{ background: "var(--backdrop-bg)" }}
      />
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4">
        <div
          className="relative rounded-2xl max-w-2xl w-full my-8 p-6 sm:p-8 shadow-xl"
          style={{ background: "var(--surface-overlay)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 btn-ghost cursor-pointer p-2 rounded-lg hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-rb-100 dark:bg-rb-800 flex items-center justify-center overflow-hidden">
              <svg className="w-7 h-7" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <use href="#icon-liquity" />
              </svg>
            </span>
            <div>
              <h2 className="text-xl font-bold leading-tight">Liquity V2 preferences</h2>
              <p className="text-xs text-rb-500 mt-0.5">
                Customise the risk thresholds applied across this protocol's positions.
              </p>
            </div>
          </div>

          <section>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-rb-500 mb-3">
              Risk-zone thresholds
            </div>
            <p className="text-xs text-rb-500 leading-relaxed mb-5">
              Collateral-ratio cut-offs that classify a position as Conservative,
              Moderate, or Aggressive. Used by the price-runway widget on each
              trove and the CR colour on the timeline. Liquidation occurs at
              each branch's MCR (110% on WETH, 120% on wstETH and rETH) and is
              not user-editable. Thresholds apply across all branches.
            </p>

            <ThresholdRow
              label="Conservative"
              dotClass="bg-emerald-500"
              textClass="text-emerald-400"
              value={v2.crConservativeMin}
              onChange={(v) => setThreshold("crConservativeMin", v)}
              suffix="% CR or higher"
              hint={`Default ${DEFAULT_LIQUITY_V2_PREFERENCES.crConservativeMin}%`}
            />
            <ThresholdRow
              label="Moderate"
              dotClass="bg-amber-500"
              textClass="text-amber-400"
              value={v2.crModerateMin}
              onChange={(v) => setThreshold("crModerateMin", v)}
              suffix={`% CR up to ${v2.crConservativeMin}%`}
              hint={`Default ${DEFAULT_LIQUITY_V2_PREFERENCES.crModerateMin}%`}
            />
            <ThresholdRow
              label="Aggressive"
              dotClass="bg-orange-500"
              textClass="text-orange-400"
              value={null}
              suffix={`branch MCR up to ${v2.crModerateMin}% CR`}
              hint="Auto — derived"
            />
            <ThresholdRow
              label="Liquidation"
              dotClass="bg-red-500"
              textClass="text-red-400"
              value={null}
              suffix="below branch MCR (110% WETH · 120% wstETH/rETH)"
              hint="Fixed by protocol"
            />
          </section>

          <div className="flex items-center justify-end mt-8">
            <button
              type="button"
              onClick={reset}
              disabled={isDefault}
              className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${
                isDefault
                  ? "text-rb-400 dark:text-rb-700 cursor-default"
                  : "text-rb-500 hover:text-foreground hover:bg-rb-200 dark:hover:bg-rb-800 cursor-pointer"
              }`}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ThresholdRow({
  label,
  dotClass,
  textClass,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  dotClass: string;
  textClass: string;
  value: number | null;
  onChange?: (v: number) => void;
  suffix: string;
  hint: string;
}) {
  const editable = value !== null && !!onChange;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-rb-200/40 dark:border-rb-800/40 last:border-b-0">
      <span className={`w-2.5 h-2.5 rounded-full ${dotClass} shrink-0`} aria-hidden="true" />
      <span className={`text-sm font-semibold ${textClass} w-28`}>{label}</span>
      <span className="text-xs text-rb-500 flex-1">
        {editable ? (
          <>
            <input
              type="number"
              inputMode="numeric"
              value={value!}
              min={121}
              max={1000}
              step={5}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) onChange!(v);
              }}
              className="bg-rb-200 dark:bg-rb-900 rounded px-2 py-1 text-sm font-bold tabular-nums w-20 outline-none ring-1 ring-transparent focus:ring-blue-500/50 text-foreground"
            />
            <span className="ml-2">{suffix}</span>
          </>
        ) : (
          <span className="text-rb-500 italic">{suffix}</span>
        )}
      </span>
      <span className="text-[10px] text-rb-500 shrink-0 tabular-nums">{hint}</span>
    </div>
  );
}
