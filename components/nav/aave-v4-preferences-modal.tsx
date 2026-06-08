"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "@/lib/shared/preferences-context";
import { DEFAULT_AAVE_V4_PREFERENCES } from "@/lib/shared/preferences";

/**
 * Fullscreen modal for Aave V4 preferences.
 *
 * Aave's collateral assets each have their own liquidation threshold (LT), so
 * there's no single MCR to express prefs against the way Liquity does. Instead
 * the user picks a single "headroom %" — how far above each asset's
 * liquidation price the Conservative zone begins. The price-runway widget on
 * the wallet detail page computes `thresholdPrice = liqPrice × (1 +
 * headroom/100)` per row from this. Anything below the threshold but above
 * liqPrice sits in Caution; below liqPrice is Liquidation.
 *
 * Setting is global on purpose — per-asset overrides multiply state without
 * adding much utility, and bluechip vs. volatile assets already separate
 * themselves naturally at the same headroom (volatile assets sit deeper in
 * Caution at a given setting, which is the desired conservatism).
 */

export function AaveV4PreferencesModal({ onClose }: { onClose: () => void }) {
  const { prefs, update } = usePreferences();
  const v4 = prefs.aaveV4;

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

  const setHeadroom = (value: number) => {
    if (!isFinite(value) || value <= 0) return;
    update({ aaveV4: { ...v4, headroomConservativeMin: Math.min(500, Math.max(1, value)) } });
  };

  const reset = () => update({ aaveV4: DEFAULT_AAVE_V4_PREFERENCES });
  const isDefault = v4.headroomConservativeMin === DEFAULT_AAVE_V4_PREFERENCES.headroomConservativeMin;

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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <img
              src="/icons/protocols/aave-v4.png"
              alt=""
              className="w-10 h-10 shrink-0 rounded-xl"
            />
            <div>
              <h2 className="text-xl font-bold leading-tight">Aave V4 preferences</h2>
              <p className="text-xs text-rb-500 mt-0.5">
                Customise the risk zones applied to the price-runway widget.
              </p>
            </div>
          </div>

          <section>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-rb-500 mb-3">
              Risk-zone threshold
            </div>
            <p className="text-xs text-rb-500 leading-relaxed mb-5">
              The Conservative cut-off — how far above an asset&apos;s
              liquidation price the safe zone begins. Anything between the
              threshold and the liq price sits in Caution (amber); below liq
              price is Liquidation (red). Applies to every collateral asset
              across every spoke.
            </p>

            <div className="rounded-xl border border-rb-200/60 dark:border-rb-800/60 p-4 space-y-3">
              <HeadroomRow
                label="Conservative"
                dotClass="bg-emerald-500"
                textClass="text-emerald-400"
                value={v4.headroomConservativeMin}
                onChange={setHeadroom}
                suffix="% headroom above liq price or more"
              />
              <HeadroomRow
                label="Caution"
                dotClass="bg-amber-500"
                textClass="text-amber-400"
                value={null}
                suffix={`liq price up to +${v4.headroomConservativeMin}% headroom`}
              />
              <HeadroomRow
                label="Liquidation"
                dotClass="bg-red-500"
                textClass="text-red-400"
                value={null}
                suffix="at or below liq price"
              />
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
              Reset to default
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HeadroomRow({
  label,
  dotClass,
  textClass,
  value,
  onChange,
  suffix,
}: {
  label: string;
  dotClass: string;
  textClass: string;
  value: number | null;
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
              min={1}
              max={500}
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
