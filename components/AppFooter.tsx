"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

/** Slim app footer used on protocol pages (/liquity-v2, /trove/*).
 *  Single row: copyright + legal on the left, protocol switcher + theme
 *  toggle on the right. The "Built with support from Liquity" credit has
 *  been retired from this surface — it lives on the marketing site footer
 *  (see SiteFooter) where the messaging context fits. */
export function AppFooter() {
  return (
    <footer className="border-t border-rb-200 dark:border-rb-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <p className="text-xs text-rb-500">© {new Date().getFullYear()} Rails</p>
            <div className="flex gap-4">
              <Link
                href="/privacy"
                className="text-rb-500 hover:text-foreground text-xs transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-rb-500 hover:text-foreground text-xs transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ProtocolSwitcher />
            <FooterThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

function ProtocolLink({
  href,
  iconSrc,
  label,
  onClick,
}: {
  href: string;
  iconSrc: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 text-rb-500 hover:text-foreground text-sm transition-colors px-3 py-2 rounded-md hover:bg-rb-200 dark:hover:bg-rb-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} alt="" width={16} height={16} className="rounded-[3px] shrink-0" />
      {label}
    </Link>
  );
}

/** Dropdown trigger for the protocol switcher. Sits at the top of the app
 *  footer; the panel opens upward (the footer is at the bottom of the page).
 *  Outside-click and Escape close it. */
function ProtocolSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-rb-500 hover:text-foreground transition-colors cursor-pointer px-2 py-1.5 rounded-md hover:bg-rb-200 dark:hover:bg-rb-800"
      >
        Protocol explorers
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 min-w-[180px] rounded-xl border border-rb-200 dark:border-rb-800 bg-rb-50 dark:bg-rb-950 shadow-lg p-1 z-30"
        >
          <ProtocolLink
            href="/liquity-v2"
            iconSrc="/icons/protocols/liquity.png"
            label="Liquity V2"
            onClick={() => setOpen(false)}
          />
          <ProtocolLink
            href="/aave-v4"
            iconSrc="/icons/protocols/aave-v4.png"
            label="Aave V4"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/** Inline icon-only theme toggle, matching rails-explorer's footer affordance.
 *  Mounted-flag avoids the SSR/CSR mismatch since `resolvedTheme` is only
 *  defined client-side. */
function FooterThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-rb-500 hover:text-foreground transition-colors cursor-pointer p-1"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}
