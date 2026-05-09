"use client";

/**
 * Interactive input primitives for what-if simulators.
 *
 * These started life inside the Liquity V2 simulator card and have been
 * lifted out so future simulators (f(x), Frankencoin, Aave, etc.) can
 * build on the same click-to-edit vocabulary.
 */

import { useEffect, useRef, useState } from "react";

/**
 * Move focus to the next/previous editable simulator input (marked
 * `data-sim-focus`) relative to `current`. Used when committing a value with
 * Enter or Tab so the user can step through the row stack — including the
 * runway price pills above and the simulator card amounts below — without
 * leaving the keyboard. Wraps at the boundaries so the chain behaves like a
 * focus trap once you're inside the sim. Returns true if a target was found
 * (lets callers decide whether to preventDefault native Tab).
 *
 * Both the button and input states of each widget carry `data-sim-focus`, so
 * the index is stable across the commit-driven swap.
 */
export function advanceToNextSimInput(current: HTMLElement, direction: 1 | -1 = 1): boolean {
  const list = Array.from(document.querySelectorAll<HTMLElement>("[data-sim-focus]"));
  if (list.length === 0) return false;
  const idx = list.indexOf(current);
  if (idx < 0) return false;
  // Wrap at the ends so Tab/Shift+Tab cycle the sim chain rather than falling
  // out into the broader page (where the timeline is the next focusable and
  // there's no obvious way back in).
  const targetIdx = (idx + direction + list.length) % list.length;
  // Defer until React has swapped the input back to its display button — we
  // want the *next* widget, not the post-commit re-render of the current one.
  requestAnimationFrame(() => {
    const fresh = Array.from(document.querySelectorAll<HTMLElement>("[data-sim-focus]"));
    const target = fresh[targetIdx];
    if (!target) return;
    target.focus();
    // Buttons need a click to enter edit mode; inputs auto-select.
    if (target instanceof HTMLButtonElement) {
      target.click();
    } else if (target instanceof HTMLInputElement) {
      target.select?.();
    }
  });
  return true;
}

/**
 * When sim editables are present on the page, route Tab/Shift+Tab from any
 * non-sim element into the chain (Tab → first sim input, Shift+Tab → last).
 * Combined with the wrap-around in `advanceToNextSimInput`, this means once
 * the user is in the sim flow they cycle through it; if they click out into
 * the timeline or elsewhere, the next Tab brings them straight back in.
 *
 * Bails out cleanly when no `data-sim-focus` elements exist (sim closed or
 * not on the page), so it's safe to install eagerly at the protocol root.
 */
export function useSimTabRouting() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key !== "Tab") return;
      const list = Array.from(document.querySelectorAll<HTMLElement>("[data-sim-focus]"));
      if (list.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      // If the user is already on a sim input, the input's own handler routes
      // through the chain — don't double-handle here.
      if (active && list.includes(active)) return;
      e.preventDefault();
      const target = e.shiftKey ? list[list.length - 1] : list[0];
      target.focus();
      if (target instanceof HTMLButtonElement) target.click();
      else if (target instanceof HTMLInputElement) target.select?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

export function EditableNumber({
  value,
  decimals = 2,
  onChange,
  className,
  min,
  max,
  trimZeros = false,
}: {
  value: number;
  decimals?: number;
  onChange: (v: number) => void;
  className?: string;
  min: number;
  max: number;
  /** Strip trailing zeros from the display value (e.g. 332.5000 → 332.5). Edit
   *  mode still uses the full precision so users see the decimals they can
   *  adjust. */
  trimZeros?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const startEditing = () => {
    setEditText(value.toFixed(decimals));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const commitEdit = () => {
    setEditing(false);
    const v = parseFloat(editText);
    if (!isNaN(v)) onChange(clamp(v));
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-sim-focus
        type="text"
        inputMode="decimal"
        value={editText}
        onChange={e => setEditText(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            const el = e.currentTarget;
            commitEdit();
            advanceToNextSimInput(el, 1);
          } else if (e.key === "Tab") {
            const el = e.currentTarget;
            const dir: 1 | -1 = e.shiftKey ? -1 : 1;
            if (advanceToNextSimInput(el, dir)) {
              e.preventDefault();
              commitEdit();
            }
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        onClick={e => e.stopPropagation()}
        className={`bg-rb-200 dark:bg-rb-900 rounded px-1 py-0 text-sm font-bold tabular-nums w-20 outline-none ring-1 ring-blue-500/50 ${className ?? "text-foreground"}`}
      />
    );
  }
  const display = trimZeros ? parseFloat(value.toFixed(decimals)).toString() : value.toFixed(decimals);
  return (
    <button
      type="button"
      data-sim-focus
      onClick={(e) => { e.stopPropagation(); startEditing(); }}
      className={`text-sm font-bold tabular-nums cursor-text px-1 rounded hover:bg-rb-200 dark:hover:bg-rb-900 transition-colors ${className ?? ""}`}
    >
      {display}
    </button>
  );
}

/**
 * Clickable arrow between before/after state. When clicked, replaces itself
 * with a small input that accepts a signed delta (e.g. "-4000" to repay 4000
 * debt). On commit, `onChange` is called with `base + delta` (clamped).
 */
export function DeltaArrow({
  base,
  onChange,
  min,
  max,
  decimals = 2,
}: {
  base: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  decimals?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const startEditing = () => {
    setEditText("");
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commitEdit = () => {
    setEditing(false);
    const text = editText.trim();
    if (text === "" || text === "+" || text === "-") return;
    const delta = parseFloat(text);
    if (!isNaN(delta)) onChange(clamp(base + delta));
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-sim-focus
        type="text"
        inputMode="decimal"
        placeholder="+/-"
        value={editText}
        onChange={e => setEditText(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            const el = e.currentTarget;
            commitEdit();
            advanceToNextSimInput(el, 1);
          } else if (e.key === "Tab") {
            const el = e.currentTarget;
            const dir: 1 | -1 = e.shiftKey ? -1 : 1;
            if (advanceToNextSimInput(el, dir)) {
              e.preventDefault();
              commitEdit();
            }
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        onClick={e => e.stopPropagation()}
        title={`Enter change (e.g. -${(10 ** decimals).toString()} to subtract)`}
        className="bg-rb-200 dark:bg-rb-900 rounded px-1 py-0 text-xs font-medium tabular-nums w-16 outline-none ring-1 ring-blue-500/50"
      />
    );
  }
  return (
    <button
      type="button"
      data-sim-focus
      onClick={(e) => { e.stopPropagation(); startEditing(); }}
      aria-label="Enter change amount"
      title="Click to enter change (e.g. -4000 to subtract)"
      className="inline-flex items-center justify-center rounded hover:bg-rb-200 dark:hover:bg-rb-900 transition-colors cursor-pointer flex-shrink-0"
    >
      <svg className="w-4 h-4 text-rb-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
