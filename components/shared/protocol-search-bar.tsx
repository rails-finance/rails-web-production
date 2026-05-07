"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Single-input Liquity search wired to the existing /troves filter behavior:
 *  Trove ID → ?troveId=, address → ?ownerAddress=, ENS → ?ownerEns=.
 *  Lifted out of HomeHero so the new /liquity-v2 protocol landing can use it
 *  without dragging the whole hero animation along. */
export function ProtocolSearchBar() {
  const [value, setValue] = useState("");
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

    router.push(`/troves?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-rb-500"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search address, ENS, or Trove ID…"
          className="w-full pl-11 pr-4 py-3 text-sm bg-rb-100 dark:bg-rb-900 text-foreground border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-colors placeholder-rb-500 rounded-full"
          aria-label="Search address, ENS, or Trove ID"
        />
      </div>
    </form>
  );
}
