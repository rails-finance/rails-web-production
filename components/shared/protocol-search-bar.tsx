"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertSession } from "@/lib/shared/sessions";

interface ProtocolSearchBarProps {
  /** Fires after a successful router.push — the dropdown variant uses this to
   *  close itself once the user has submitted a query. */
  onAfterSubmit?: () => void;
  /** Smaller padding + placeholder for the WalletMenu dropdown. */
  compact?: boolean;
  autoFocus?: boolean;
}

/** Single-input Liquity search wired to the existing /liquity-v2 filter behavior:
 *  Trove ID → ?troveId=, address → ?ownerAddress=, ENS → ?ownerEns=.
 *  Lifted out of HomeHero so the new /liquity-v2 protocol landing can use it
 *  without dragging the whole hero animation along. */
export function ProtocolSearchBar({
  onAfterSubmit,
  compact = false,
  autoFocus = false,
}: ProtocolSearchBarProps = {}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const isTroveId = /^\d+$/.test(trimmed);
    const isEns = trimmed.toLowerCase().endsWith(".eth");
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    if (!isTroveId && !isAddress && !isEns) return;

    const params = new URLSearchParams();
    if (isTroveId) params.set("troveId", trimmed);
    else if (isAddress) params.set("ownerAddress", trimmed);
    else if (isEns) params.set("ownerEns", trimmed);

    // Record address submissions immediately so the wallet appears in the
    // recent list. ENS submissions wait until the trove page resolves them
    // to a 0x address (sessions are keyed on lowercase addresses, never on
    // the .eth string). Trove-ID submissions never record — they're a trove
    // lookup, not a wallet visit.
    if (isAddress) {
      const lower = trimmed.toLowerCase();
      upsertSession([lower], { [lower]: null }, ["liquity-v2-troves"]);
    }

    router.push(`/liquity-v2?${params.toString()}`);
    setValue("");
    onAfterSubmit?.();
  };

  const iconSize = compact ? 16 : 18;
  // Compact (dropdown) variant uses rounded-lg to match the session card
  // shape; full variant keeps the pill on the hero/landing.
  const inputClasses = compact
    ? "w-full pl-10 pr-3 py-2.5 text-sm bg-rb-100 dark:bg-rb-900 text-foreground border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-colors placeholder-rb-500 rounded-lg"
    : "w-full pl-11 pr-4 py-3 text-sm bg-rb-100 dark:bg-rb-900 text-foreground border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-colors placeholder-rb-500 rounded-full";
  const iconClasses = compact
    ? "absolute left-3 top-1/2 -translate-y-1/2 text-rb-500"
    : "absolute left-4 top-1/2 -translate-y-1/2 text-rb-500";

  // Compact variant suppresses the placeholder until the input is focused —
  // keeps the dropdown visually quiet when the user is just browsing pinned/
  // recent. Full variant always shows the placeholder (it's the only hint).
  const placeholder = compact
    ? focused
      ? "Address, ENS, or Trove ID…"
      : ""
    : "Search address, ENS, or Trove ID…";

  return (
    <form onSubmit={onSubmit}>
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses}
          onClick={() => inputRef.current?.focus()}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={inputClasses}
          aria-label="Search address, ENS, or Trove ID"
        />
      </div>
    </form>
  );
}
