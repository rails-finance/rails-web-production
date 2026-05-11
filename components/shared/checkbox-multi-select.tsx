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

export function CheckboxMultiSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  minWidth,
}: Props) {
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

  const pillText = count > 0 ? `${label} (${count})` : label;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`cursor-pointer flex items-center gap-2 h-10 px-4 py-2 rounded-lg text-foreground font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          count > 0
            ? "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-400"
            : "bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800"
        }`}
        style={minWidth ? { minWidth } : undefined}
        aria-expanded={isOpen}
        aria-label={`Filter ${label}`}
      >
        <span className="whitespace-nowrap">{pillText}</span>
        <ChevronDown
          className={`w-4 h-4 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-rb-100 dark:bg-rb-800 border border-rb-300 dark:border-rb-700 rounded-lg shadow-xl z-50 min-w-[220px] max-h-[460px] overflow-y-auto py-1"
          role="menu"
        >
          {/* All radio row — clears the selection. */}
          <button
            type="button"
            onClick={clearAll}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-rb-200 dark:hover:bg-rb-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
            role="menuitemradio"
            aria-checked={count === 0}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors ${
                count === 0
                  ? "bg-blue-500 border-blue-500"
                  : "border-rb-400 dark:border-rb-600"
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
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-rb-200 dark:hover:bg-rb-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  checked ? "bg-rb-200/40 dark:bg-rb-700/40" : ""
                }`}
                role="menuitemcheckbox"
                aria-checked={checked}
              >
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                    checked
                      ? "bg-blue-500"
                      : "border-2 border-rb-400 dark:border-rb-600"
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
