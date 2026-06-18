"use client";

import { useCallback, useState } from "react";

/**
 * Standard "plain language" help affordance — the single info grammar for every
 * card in the product. Renders a page-background pill at the bottom-left of the
 * card: a solid (i) disc with a chevron to its right (pointing down when
 * closed, up when open). Clicking expands a rounded panel *within* the card —
 * the pill moves to the panel's top-left, the explanation renders below, and an
 * optional footer (gas / Etherscan) pins to the bottom.
 *
 * Replaces the older right-aligned `InfoIconButton` / `SpokeInfoButton` /
 * per-element triggers (e.g. the price-runway (i)). Keep new help affordances
 * on this component so location + style stay consistent across rails.
 *
 * Controlled (`open` + `onToggle`) or uncontrolled (`defaultOpen`). `warning`
 * swaps the disc to a red triangle so dangerous states surface without a click.
 *
 * The disc uses the existing (i) glyph, whose center "i" is a cutout — it shows
 * the pill/panel background through it (near-white in light mode). The disc is
 * filled with the app's utility hue (teal, per ui-grammar.ts) so the help
 * affordance reads as an in-place utility action; in dark mode it lightens to
 * stay legible against the dark canvas.
 */

const INFO_PATH =
  "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z";
const WARNING_PATH =
  "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z";

export interface InfoDisclosureProps {
  /** Controlled open state. Omit to use internal (uncontrolled) state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** Swap the (i) disc for a red warning triangle. */
  warning?: boolean;
  /** Explanation body, shown when open. */
  children: React.ReactNode;
  /** Optional footer row pinned to the bottom of the open panel. */
  footer?: React.ReactNode;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** aria-label noun — "Show {label}" / "Hide {label}". */
  label?: string;
}

export function InfoDisclosure({
  open: openProp,
  defaultOpen = false,
  onToggle,
  warning = false,
  children,
  footer,
  className,
  label = "details",
}: InfoDisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !open;
      if (!isControlled) setInternalOpen(next);
      onToggle?.(next);
    },
    [open, isControlled, onToggle],
  );

  // The pill keeps the same padding/background in both states so the glyph
  // never shifts when the panel opens — the expanded panel's body padding lives
  // on the content, not the trigger frame. Hover only re-tones the icon +
  // chevron (brighter in dark mode, darker in light), never the pill fill.
  const trigger = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={open ? `Hide ${label}` : `Show ${label}`}
      className="group/info inline-flex cursor-pointer items-center gap-1 rounded-full bg-background p-1"
    >
      <svg
        className={`h-5 w-5 transition-colors ${
          warning
            ? "text-red-500 dark:text-red-400"
            : "text-teal-600 group-hover/info:text-teal-700 dark:text-teal-400 dark:group-hover/info:text-teal-300"
        }`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path fillRule="evenodd" d={warning ? WARNING_PATH : INFO_PATH} clipRule="evenodd" />
      </svg>
      <svg
        className={`mr-0.5 h-3 w-3 text-rb-500 transition-[color,transform] duration-200 group-hover/info:text-rb-700 dark:group-hover/info:text-rb-300 ${
          open ? "rotate-180" : ""
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );

  if (!open) {
    return <div className={`flex ${className ?? ""}`}>{trigger}</div>;
  }

  return (
    <div className={`rounded-xl bg-background ${className ?? ""}`}>
      {trigger}
      {children && <div className="px-3 pb-3 pt-1">{children}</div>}
      {footer}
    </div>
  );
}
