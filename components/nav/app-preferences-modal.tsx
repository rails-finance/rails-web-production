"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { usePreferences } from "@/lib/shared/preferences-context";
import type { RatioMode } from "@/lib/shared/preferences";

/**
 * Fullscreen modal for app-wide preferences — settings that should apply
 * regardless of which protocol surface the user is on. Per-protocol prefs
 * (e.g. Liquity V2 risk thresholds) live behind the cog inside each protocol
 * entry of the protocol-menu dropdown; this modal is the parent surface that
 * sits above them.
 *
 * Today: theme + ratio display (CR vs LTV). The shell is intentionally roomy
 * so future cross-protocol toggles (default landing surface, time format,
 * privacy/telemetry, etc.) can land here without rebuilding.
 */

export function AppPreferencesModal({ onClose }: { onClose: () => void }) {
  const { prefs, update } = usePreferences();
  const { resolvedTheme, setTheme } = useTheme();

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

  const isDark = resolvedTheme === "dark";

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto" onClick={onClose}>
      <div
        className="fixed inset-0 backdrop-blur-sm pointer-events-none"
        style={{ background: "var(--backdrop-bg)" }}
      />
      <div className="relative min-h-full flex items-start sm:items-center justify-center p-4">
        <div
          className="relative rounded-2xl max-w-xl w-full my-8 p-6 sm:p-8 shadow-xl"
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
            <span className="w-10 h-10 shrink-0 rounded-xl bg-rb-100 dark:bg-rb-800 flex items-center justify-center text-rb-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <div>
              <h2 className="text-xl font-bold leading-tight">Preferences</h2>
              <p className="text-xs text-rb-500 mt-0.5">
                Settings that apply across the whole app. Per-protocol settings live in the protocol picker.
              </p>
            </div>
          </div>

          <section className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-rb-500 mb-3">
              Display
            </div>

            <Row label="Theme" hint="Dark and light mode follow this setting across the whole app.">
              <SegmentToggle
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                value={isDark ? "dark" : "light"}
                onChange={(v) => setTheme(v)}
              />
            </Row>

            <Row label="Health metric" hint="Show position health as Collateral Ratio (CR = coll/debt) or Loan-to-Value (LTV = debt/coll). Colours match the same risk thresholds.">
              <SegmentToggle
                options={[
                  { value: "cr", label: "CR" },
                  { value: "ltv", label: "LTV" },
                ]}
                value={prefs.ratioMode}
                onChange={(v) => update({ ratioMode: v as RatioMode })}
              />
            </Row>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-rb-200/40 dark:border-rb-800/40 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-rb-500 leading-relaxed mt-0.5">{hint}</div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function SegmentToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly [{ value: T; label: string }, { value: T; label: string }];
  value: T;
  onChange: (next: T) => void;
}) {
  const isFirst = value === options[0].value;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!isFirst}
      onClick={() => onChange(isFirst ? options[1].value : options[0].value)}
      className="relative grid grid-cols-2 rounded-md border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 text-[11px] font-semibold cursor-pointer overflow-hidden w-32"
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1/2 bg-blue-500 transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isFirst ? "translate-x-0" : "translate-x-full"
        }`}
      />
      <span
        className={`relative z-10 px-2.5 py-1 text-center transition-colors motion-reduce:transition-none ${
          isFirst ? "text-foreground" : "text-rb-500"
        }`}
      >
        {options[0].label}
      </span>
      <span
        className={`relative z-10 px-2.5 py-1 text-center transition-colors motion-reduce:transition-none ${
          !isFirst ? "text-foreground" : "text-rb-500"
        }`}
      >
        {options[1].label}
      </span>
    </button>
  );
}
