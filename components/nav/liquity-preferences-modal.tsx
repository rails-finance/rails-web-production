"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "@/lib/shared/preferences-context";
import {
  DEFAULT_LIQUITY_V2_PREFERENCES,
  LIQUITY_V2_BRANCHES,
  type LiquityV2Branch,
  type LiquityV2BranchThresholds,
} from "@/lib/shared/preferences";
import { getLiquidationThreshold } from "@/lib/utils/liquidation-utils";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";

/**
 * Fullscreen modal for Liquity V2 preferences.
 *
 * Each collateral branch (WETH / wstETH / rETH) has its own MCR and its own
 * Conservative threshold — the cut-off above which a position is treated as
 * safe. Below it the position sits in Caution, until CR drops below MCR and
 * the position becomes liquidatable. Only the Conservative threshold is
 * user-editable; the Caution band runs from MCR up to that threshold, and
 * Liquidation is fixed by the branch's MCR (110% on WETH, 120% on
 * wstETH/rETH). The shell is intentionally roomy so future
 * Liquity-V2-specific preferences (default redemption-risk view,
 * batch-manager filters, etc.) can land here without rebuilding the surface.
 */

export function LiquityPreferencesModal({ onClose }: { onClose: () => void }) {
  const { prefs, update } = usePreferences();
  const v2 = prefs.liquityV2;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const setBranchThreshold = (branch: LiquityV2Branch, value: number) => {
    if (!isFinite(value)) return;
    const mcr = getLiquidationThreshold(branch);
    const floor = mcr + 1; // any threshold ≤ MCR is meaningless for this branch
    const crConservativeMin = Math.max(floor, value);
    update({
      liquityV2: {
        ...v2,
        byBranch: {
          ...v2.byBranch,
          [branch]: { crConservativeMin },
        },
      },
    });
  };

  const reset = () => update({ liquityV2: DEFAULT_LIQUITY_V2_PREFERENCES });
  const isDefault = LIQUITY_V2_BRANCHES.every((b) => {
    const cur = v2.byBranch[b];
    const def = DEFAULT_LIQUITY_V2_PREFERENCES.byBranch[b];
    return cur.crConservativeMin === def.crConservativeMin;
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto" onClick={onClose}>
      <div
        className="fixed inset-0 backdrop-blur-sm pointer-events-none"
        style={{ background: "var(--backdrop-bg)" }}
      />
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4">
        <div
          className="relative rounded-2xl max-w-3xl w-full my-8 p-6 sm:p-8 shadow-xl"
          style={{ background: "var(--surface-overlay)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 cursor-pointer p-2 rounded-lg hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <img src="/icons/protocols/liquity.png" alt="" className="w-10 h-10 shrink-0 rounded-xl" />
            <div>
              <h2 className="text-xl font-bold leading-tight">Liquity V2 preferences</h2>
              <p className="text-xs text-rb-500 mt-0.5">
                Customise the risk thresholds applied to each collateral branch.
              </p>
            </div>
          </div>

          <section>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-rb-500 mb-3">
              Risk-zone threshold
            </div>
            <p className="text-xs text-rb-500 leading-relaxed mb-5">
              The Conservative cut-off — collateral ratios at or above this value render emerald, anything below sits in
              Caution (orange) until the trove crosses MCR and becomes liquidatable. Each branch has its own MCR, so
              each carries its own threshold. Used by the price-runway widget on each trove and the CR colour on the
              timeline.
            </p>

            <div className="space-y-5">
              {LIQUITY_V2_BRANCHES.map((branch) => (
                <BranchBlock
                  key={branch}
                  branch={branch}
                  thresholds={v2.byBranch[branch]}
                  onChange={(val) => setBranchThreshold(branch, val)}
                />
              ))}
            </div>
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
              Reset all branches to defaults
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BranchBlock({
  branch,
  thresholds,
  onChange,
}: {
  branch: LiquityV2Branch;
  thresholds: LiquityV2BranchThresholds;
  onChange: (value: number) => void;
}) {
  const mcr = getLiquidationThreshold(branch);
  const floor = mcr + 1;
  return (
    <div className="rounded-xl border border-rb-200/60 dark:border-rb-800/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TokenChipIcon symbol={branch} size={20} />
        <span className="text-sm font-bold tabular-nums">{branch}</span>
        <span className="text-[11px] text-rb-500">MCR {mcr}%</span>
      </div>

      <ThresholdRow
        label="Conservative"
        dotClass="bg-emerald-500"
        textClass="text-emerald-400"
        value={thresholds.crConservativeMin}
        floor={floor}
        onChange={onChange}
        suffix="% CR or higher"
      />
      <ThresholdRow
        label="Caution"
        dotClass="bg-orange-500"
        textClass="text-orange-400"
        value={null}
        floor={floor}
        suffix={`${mcr}% (MCR) up to ${thresholds.crConservativeMin}% CR`}
      />
      <ThresholdRow
        label="Liquidation"
        dotClass="bg-red-500"
        textClass="text-red-400"
        value={null}
        floor={floor}
        suffix={`below ${mcr}% CR (MCR)`}
      />
    </div>
  );
}

function ThresholdRow({
  label,
  dotClass,
  textClass,
  value,
  floor,
  onChange,
  suffix,
}: {
  label: string;
  dotClass: string;
  textClass: string;
  value: number | null;
  floor: number;
  onChange?: (v: number) => void;
  suffix: string;
}) {
  const editable = value !== null && !!onChange;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-rb-200/40 dark:border-rb-800/40 last:border-b-0">
      <span className={`w-2.5 h-2.5 rounded-full ${dotClass} shrink-0`} aria-hidden="true" />
      <span className={`text-sm font-semibold ${textClass} w-28`}>{label}</span>
      <span className="text-xs text-rb-500 flex-1">
        {editable ? (
          <>
            <input
              type="number"
              inputMode="numeric"
              value={value!}
              min={floor}
              max={1000}
              step={5}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) onChange!(v);
              }}
              className="bg-sunken rounded px-2 py-1 text-sm font-bold tabular-nums w-20 outline-none ring-1 ring-transparent focus:ring-blue-500/50 text-foreground"
            />
            <span className="ml-2">{suffix}</span>
          </>
        ) : (
          <span className="text-rb-500 italic">{suffix}</span>
        )}
      </span>
    </div>
  );
}
