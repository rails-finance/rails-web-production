"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Facehash } from "@/components/shared/facehash";
import {
  loadSessions,
  SESSIONS_CHANGED_EVENT,
  type WalletSession,
} from "@/lib/shared/sessions";
import { useWalletContext } from "@/components/nav/wallet-context";
import { WalletMenu } from "@/components/nav/wallet-menu";
import { PreferencesMenu } from "@/components/nav/preferences-menu";

/** Always-on Rails wordmark on the left, with an Explorer sublabel.
 *  rails-web-mig is single-protocol (Liquity V2), so the sublabel is fixed —
 *  no Index/Explorer split like the umbrella. */
function RailsLogo() {
  return (
    <Link href="/" className="group flex items-center gap-1.5 text-foreground shrink-0">
      <svg
        width={30}
        height={30}
        viewBox="0 0 200 200"
        fill="none"
        className="opacity-80 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          style={{ opacity: 0.85 }}
          d="M 79.763 159.671 L 111.637 159.671 L 52.168 41.625 L 20.295 41.625 L 79.763 159.671 Z"
        />
        <path
          fill="currentColor"
          style={{ opacity: 0.85 }}
          d="M 98.578 97.056 L 130.451 97.056 L 105.044 47.853 L 73.171 47.853 L 98.578 97.056 Z"
        />
        <path
          fill="currentColor"
          d="M 148.892 142.388 L 180.766 142.388 L 155.359 93.185 L 123.486 93.185 L 148.892 142.388 Z"
        />
      </svg>
      <span className="text-base tracking-wide font-semibold">
        <span className="opacity-80 group-hover:opacity-100 transition-opacity">Rails</span>
        <span className="ml-1 text-blue-500">Explorer</span>
      </span>
    </Link>
  );
}

/** Static protocol indicator. Always Liquity V2 — no menu, no chevron. */
function ProtocolIndicator() {
  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 cursor-default">
      <svg className="w-4 h-4" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <use href="#icon-liquity" />
      </svg>
      <span className="text-xs font-semibold text-foreground">Liquity V2</span>
    </div>
  );
}

/** Look up the active session in localStorage so the wallet pill can show
 *  the user-set custom name without an API roundtrip. */
function useActiveSession(addresses: string[]): WalletSession | null {
  const key = useMemo(() => [...addresses].sort().join("+"), [addresses]);
  const [session, setSession] = useState<WalletSession | null>(null);

  useEffect(() => {
    if (!key) {
      setSession(null);
      return;
    }
    const sync = () => {
      const found = loadSessions().find((s) => s.key === key) ?? null;
      setSession(found);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SESSIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, sync);
    };
  }, [key]);

  return session;
}

export function HeaderBar() {
  const { addresses, ensNames } = useWalletContext();

  const walletBtn = useRef<HTMLButtonElement>(null);
  const prefsBtn = useRef<HTMLButtonElement>(null);

  const [openMenu, setOpenMenu] = useState<null | "wallet" | "prefs">(null);
  const close = useCallback(() => setOpenMenu(null), []);
  const toggle = (m: "wallet" | "prefs") =>
    setOpenMenu((prev) => (prev === m ? null : m));

  const activeAddr = addresses[0];
  const activeSession = useActiveSession(addresses);
  const triggerLabel =
    activeSession?.customName ||
    (activeAddr
      ? ensNames[activeAddr] || `${activeAddr.slice(0, 6)}…${activeAddr.slice(-4)}`
      : "");

  // Whether to render the wallet button (only when a wallet is active OR the
  // user has prior sessions to pick from).
  const hasSessions = useHasSessions();
  const showWalletButton = Boolean(activeAddr) || hasSessions;

  return (
    <header className="relative z-40 mb-2">
      <div className="max-w-7xl mx-auto py-5 px-4 md:px-6 flex items-center gap-4">
        <RailsLogo />

        <div className="flex-1" />

        {/* Protocol indicator + wallet pill share a rounded container, matching
            the umbrella header's shape. The cog sits independently to the right. */}
        <div
          className={`relative z-[90] flex items-center gap-1 shrink-0 bg-rb-200/60 border border-rb-300 dark:bg-rb-700/50 dark:border-rb-700 rounded-full pl-1 ${
            showWalletButton ? "pr-0" : "pr-2"
          }`}
        >
          <ProtocolIndicator />

          {showWalletButton && (
            <button
              ref={walletBtn}
              onClick={() => toggle("wallet")}
              aria-haspopup="menu"
              aria-expanded={openMenu === "wallet"}
              className="group flex items-center gap-1.5 bg-rb-100 dark:bg-rb-700 rounded-full px-4 py-2.5 hover:bg-rb-200 dark:hover:bg-rb-800 aria-expanded:bg-rb-200 dark:aria-expanded:bg-rb-800 transition-colors cursor-pointer text-rb-text-500"
              title="Wallets"
            >
              {activeAddr ? (
                <>
                  <div className="rounded-md relative z-10">
                    <Facehash address={activeAddr} size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate max-w-[140px] hidden sm:inline opacity-80 group-hover:opacity-100 transition-opacity">
                    {triggerLabel}
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold opacity-80 group-hover:opacity-100 transition-opacity">
                  Wallets
                </span>
              )}
            </button>
          )}
        </div>

        <button
          ref={prefsBtn}
          onClick={() => toggle("prefs")}
          aria-haspopup="menu"
          aria-expanded={openMenu === "prefs"}
          className="shrink-0 p-2 rounded-lg hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors cursor-pointer text-rb-500 hover:text-foreground"
          title="Preferences"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <WalletMenu
        anchor={openMenu === "wallet" ? walletBtn.current : null}
        positionAnchor={prefsBtn.current}
        onClose={close}
      />
      <PreferencesMenu
        anchor={openMenu === "prefs" ? prefsBtn.current : null}
        onClose={close}
      />
    </header>
  );
}

/** Reactive flag — true when localStorage has at least one session. Lets the
 *  wallet button surface even when no address is currently being viewed. */
function useHasSessions(): boolean {
  const [hasAny, setHasAny] = useState(false);
  useEffect(() => {
    const sync = () => setHasAny(loadSessions().length > 0);
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SESSIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, sync);
    };
  }, []);
  return hasAny;
}
