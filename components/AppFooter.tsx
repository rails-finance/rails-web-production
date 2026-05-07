"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/** Slim app footer used on protocol pages (/troves, /trove/*, /liquity-v2).
 *  Single-row: copyright + legal links on the left, built-with credit + a
 *  theme toggle on the right. The richer multi-column footer lives only on
 *  marketing routes (see SiteFooter). */
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
            <span className="text-rb-500 text-xs">
              Built with support from{" "}
              <a
                href="https://liquity.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Liquity
              </a>
            </span>
            <FooterThemeToggle />
          </div>
        </div>
      </div>
    </footer>
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
