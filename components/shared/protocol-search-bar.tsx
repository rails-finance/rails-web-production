"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertSession } from "@/lib/shared/sessions";
import { dispatchWalletSearch } from "@/lib/shared/wallet-dispatch";

interface ProtocolSearchBarProps {
  /** Fires after a successful router.push — the dropdown variant uses this to
   *  close itself once the user has submitted a query. */
  onAfterSubmit?: () => void;
  /** Smaller padding + placeholder for the WalletMenu dropdown. */
  compact?: boolean;
  autoFocus?: boolean;
}

/** Single-input cross-protocol search.
 *  - Trove ID → /liquity-v2?troveId= (filtered Liquity listing).
 *  - Address / ENS → dispatched via `dispatchWalletSearch`: lands on the
 *    correct per-protocol wallet page when only one protocol has hits, on
 *    /wallet/[address] when multiple do, and on /wallet/[address] (empty
 *    state) when none do. */
export function ProtocolSearchBar({
  onAfterSubmit,
  compact = false,
  autoFocus = false,
}: ProtocolSearchBarProps = {}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dispatching) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    const isTroveId = /^\d+$/.test(trimmed);
    if (isTroveId) {
      router.push(`/liquity-v2?troveId=${encodeURIComponent(trimmed)}`);
      setValue("");
      onAfterSubmit?.();
      return;
    }

    setDispatching(true);
    try {
      const result = await dispatchWalletSearch(trimmed);
      if (!result) return; // unparseable input — leave value untouched

      // Record the wallet in recents only when we have a resolved address and
      // at least one protocol with hits. Avoids polluting recents with typos
      // or random addresses that match no protocol coverage.
      if (result.resolvedAddress && result.protocols.length > 0) {
        upsertSession(
          [result.resolvedAddress],
          { [result.resolvedAddress]: result.ensName },
          result.protocols,
        );
      }

      router.push(result.url);
      setValue("");
      onAfterSubmit?.();
    } finally {
      setDispatching(false);
    }
  };

  const iconSize = compact ? 16 : 18;
  // Compact (dropdown) variant uses rounded-lg to match the session card
  // shape; full variant keeps the pill on the hero/landing.
  const inputClasses = compact
    ? "w-full pl-10 pr-3 py-2.5 text-sm bg-rb-100 dark:bg-rb-900 text-foreground border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-colors placeholder-rb-500 rounded-lg disabled:opacity-60 disabled:cursor-progress"
    : "w-full pl-11 pr-4 py-3 text-sm bg-rb-100 dark:bg-rb-900 text-foreground border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-colors placeholder-rb-500 rounded-full disabled:opacity-60 disabled:cursor-progress";
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
          placeholder={dispatching ? "Searching…" : placeholder}
          className={inputClasses}
          aria-label="Search address, ENS, or Trove ID"
          disabled={dispatching}
        />
      </div>
    </form>
  );
}
