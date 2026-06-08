"use client";

/**
 * CheckboxMultiSelect — pill trigger + dropdown with an "All" radio row
 * and a list of checkbox rows. Optional icon slot per option.
 *
 * Semantics: empty selection === "all". Clicking the All row clears the
 * selection. Clicking an option toggles it in/out of the set. The dropdown
 * stays open across multi-selection (closes on outside click / Esc).
 *
 * Used by Aave V4 hub/spoke filters (icon-less) and Liquity V2 collateral
 * filter (with token icons).
 */

import { useEffect, useRef, useState, ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON, COUNT_BADGE } from "@/lib/shared/ui-grammar";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  /** Override the "All X" radio label. Default: `All ${label}` */
  allLabel?: string;
  /** Pill width hint (min-width on the trigger). */
  minWidth?: number;
  /** Show the trigger as currently active even with no selection. */
  alwaysShowChevron?: boolean;
}

export function CheckboxMultiSelect({ label, value, onChange, options, allLabel, minWidth }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const selectedSet = new Set(value);
  const count = value.length;

  const toggle = (v: string) => {
    if (selectedSet.has(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${CTRL_GHOST} ${count > 0 || isOpen ? CTRL_ON : CTRL_OFF} gap-2 h-8 px-3 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500`}
        style={minWidth ? { minWidth } : undefined}
        aria-expanded={isOpen}
        aria-label={`Filter ${label}`}
      >
        <span className="whitespace-nowrap">{label}</span>
        {count > 0 && <span className={COUNT_BADGE}>{count}</span>}
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 z-50 min-w-[220px] max-h-[460px] overflow-y-auto py-1 overlay-panel"
          role="menu"
        >
          {/* All radio row — clears the selection. */}
          <button
            type="button"
            onClick={clearAll}
            className={`flex items-center gap-3 mx-1 my-0.5 px-4 py-2 rounded-lg text-sm text-foreground hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
            role="menuitemradio"
            aria-checked={count === 0}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors ${
                count === 0 ? "bg-rb-500 border-rb-500" : "border-rb-400 dark:border-rb-600"
              }`}
              aria-hidden="true"
            >
              {count === 0 && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            <span className="text-left">{allLabel ?? `All ${label.toLowerCase()}`}</span>
          </button>

          <div className="my-1 mx-3 border-t border-rb-300 dark:border-rb-700" />

          {options.map((o) => {
            const checked = selectedSet.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={`flex items-center gap-3 mx-1 my-0.5 px-4 py-2 rounded-lg text-sm text-foreground hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  checked ? "bg-rb-200/40 dark:bg-rb-700/40" : ""
                }`}
                role="menuitemcheckbox"
                aria-checked={checked}
              >
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                    checked ? "bg-rb-500" : "border-2 border-rb-400 dark:border-rb-600"
                  }`}
                  aria-hidden="true"
                >
                  {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                {o.icon && <span className="shrink-0 flex items-center">{o.icon}</span>}
                <span className="text-left">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
