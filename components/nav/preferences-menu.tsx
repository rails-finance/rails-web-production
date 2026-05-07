"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FloatingPanel } from "@/components/shared/floating-panel";

interface PreferencesMenuProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
}

export function PreferencesMenu({
  anchor,
  onClose,
  onPanelMouseEnter,
  onPanelMouseLeave,
}: PreferencesMenuProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!anchor) return null;

  // resolvedTheme isn't safe to read until after mount (SSR mismatch).
  const value: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <FloatingPanel
      anchor={anchor}
      onClose={onClose}
      onPanelMouseEnter={onPanelMouseEnter}
      onPanelMouseLeave={onPanelMouseLeave}
      width={280}
      minSpaceBelow={160}
      closeOnScroll={false}
      ariaLabel="Preferences"
    >
      <div className="p-4 space-y-4">
        <section>
          <div className="text-[11px] font-bold text-rb-500 dark:text-rb-400 uppercase tracking-wider mb-3">
            Display
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Theme</span>
            <LabeledToggle
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
              value={value}
              onChange={(next) => setTheme(next)}
            />
          </div>
        </section>
      </div>
    </FloatingPanel>
  );
}

interface LabeledToggleProps<T extends string> {
  options: readonly [{ value: T; label: string }, { value: T; label: string }];
  value: T;
  onChange: (next: T) => void;
}

function LabeledToggle<T extends string>({ options, value, onChange }: LabeledToggleProps<T>) {
  const isFirst = value === options[0].value;
  const next = isFirst ? options[1].value : options[0].value;
  const currentLabel = isFirst ? options[0].label : options[1].label;
  const nextLabel = isFirst ? options[1].label : options[0].label;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!isFirst}
      aria-label={`${currentLabel} selected — click to switch to ${nextLabel}`}
      onClick={() => onChange(next)}
      className="relative grid grid-cols-2 rounded-md border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 text-[11px] font-semibold cursor-pointer overflow-hidden"
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1/2 bg-blue-500 transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isFirst ? "translate-x-0" : "translate-x-full"
        }`}
      />
      <span
        className={`relative z-10 px-2.5 py-1 text-center transition-colors motion-reduce:transition-none ${
          isFirst ? "text-foreground" : "text-rb-500 dark:text-rb-400"
        }`}
      >
        {options[0].label}
      </span>
      <span
        className={`relative z-10 px-2.5 py-1 text-center transition-colors motion-reduce:transition-none ${
          !isFirst ? "text-foreground" : "text-rb-500 dark:text-rb-400"
        }`}
      >
        {options[1].label}
      </span>
    </button>
  );
}
