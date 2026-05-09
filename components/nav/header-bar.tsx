"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Facehash } from "@/components/shared/facehash";
import {
  loadSessions,
  SESSIONS_CHANGED_EVENT,
  type WalletSession,
} from "@/lib/shared/sessions";
import { useWalletContext } from "@/components/nav/wallet-context";
import { WalletMenu } from "@/components/nav/wallet-menu";
import { ProtocolMenu } from "@/components/nav/protocol-menu";
import { LiquityPreferencesModal } from "@/components/nav/liquity-preferences-modal";

/** Routes that count as "inside the protocol" — the protocol app-switcher
 *  button is gated on these. Marketing routes (home, about, blog, …) hide
 *  the button entirely; once we add sibling mono-rails the dropdown lets
 *  users hop between them from any of these surfaces. */
const PROTOCOL_PATH_PREFIXES = ["/liquity-v2", "/trove", "/address"];

function isProtocolPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTOCOL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

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

/** App-switcher trigger.
 *  - On a protocol surface: shows the protocol icon + label (current context).
 *  - Elsewhere: shows a neutral apps-grid icon (no protocol selected yet).
 *  Today the dropdown lists Liquity V2 as the sole entry; future sibling
 *  mono-rails will appear in the same menu. */
const ProtocolButton = ({
  isOpen,
  onToggle,
  btnRef,
  inProtocol,
}: {
  isOpen: boolean;
  onToggle: () => void;
  btnRef: React.RefObject<HTMLButtonElement | null>;
  inProtocol: boolean;
}) => (
  <button
    ref={btnRef}
    onClick={onToggle}
    aria-haspopup="menu"
    aria-expanded={isOpen}
    title={inProtocol ? "Switch protocol" : "Choose protocol"}
    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-rb-100 dark:hover:bg-rb-800 aria-expanded:bg-rb-100 dark:aria-expanded:bg-rb-800 transition-colors cursor-pointer"
  >
    {inProtocol ? (
      <>
        {/* App icons are rounded-square PNGs (matched with facehashes);
            tokens stay circular. Use the home-page protocol asset rather
            than the circular icon-liquity SVG so the framing is consistent. */}
        <img
          src="/icons/protocols/liquity.png"
          alt=""
          className="w-5 h-5 shrink-0 rounded-[5px]"
        />
        <span className="text-xs font-semibold text-foreground">Liquity V2</span>
      </>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-rb-500 group-hover:text-foreground transition-colors"
      >
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    )}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-rb-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </button>
);

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
  const pathname = usePathname();

  const protocolBtn = useRef<HTMLButtonElement>(null);
  const walletBtn = useRef<HTMLButtonElement>(null);

  const [openMenu, setOpenMenu] = useState<null | "protocol" | "wallet">(null);
  const close = useCallback(() => setOpenMenu(null), []);
  const toggle = (m: "protocol" | "wallet") =>
    setOpenMenu((prev) => (prev === m ? null : m));

  // Per-protocol preferences modal — opened from inside the protocol-menu
  // dropdown. State lives here so the modal sits at the header level and
  // overlays everything regardless of where it was triggered.
  const [prefsForProtocol, setPrefsForProtocol] = useState<string | null>(null);

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
  // Protocol app-switcher always renders. Inside a protocol surface it shows
  // the active protocol icon + label; elsewhere it shows a neutral apps-grid
  // icon to advertise the picker without committing to a protocol context.
  const inProtocol = isProtocolPath(pathname);

  return (
    <header className="relative z-40 mb-2">
      <div className="max-w-7xl mx-auto py-5 px-4 md:px-6 flex items-center gap-4">
        <RailsLogo />

        <div className="flex-1" />

        <div
          className={`relative z-[90] flex items-center gap-1 shrink-0 bg-rb-200/60 border border-rb-300 dark:bg-rb-700/50 dark:border-rb-700 rounded-full pl-1 ${
            showWalletButton ? "pr-0" : "pr-2"
          }`}
        >
          <ProtocolButton
            isOpen={openMenu === "protocol"}
            onToggle={() => toggle("protocol")}
            btnRef={protocolBtn}
            inProtocol={inProtocol}
          />
          {showWalletButton && (
            <WalletPillButton
              btnRef={walletBtn}
              isOpen={openMenu === "wallet"}
              onClick={() => toggle("wallet")}
              activeAddr={activeAddr}
              triggerLabel={triggerLabel}
            />
          )}
        </div>

      </div>

      <ProtocolMenu
        anchor={openMenu === "protocol" ? protocolBtn.current : null}
        onClose={close}
        onOpenPreferences={(protocolId) => setPrefsForProtocol(protocolId)}
      />
      <WalletMenu
        anchor={openMenu === "wallet" ? walletBtn.current : null}
        onClose={close}
      />
      {prefsForProtocol === "liquity-v2" && (
        <LiquityPreferencesModal onClose={() => setPrefsForProtocol(null)} />
      )}
    </header>
  );
}

/** The address/wallet pill — extracted because it now renders either inside
 *  the outer protocol pill (on protocol routes) or standalone (everywhere else). */
function WalletPillButton({
  btnRef,
  isOpen,
  onClick,
  activeAddr,
  triggerLabel,
}: {
  btnRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClick: () => void;
  activeAddr: string | undefined;
  triggerLabel: string;
}) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      className="group flex items-center gap-1.5 bg-rb-100 dark:bg-rb-700 rounded-full px-4 py-2.5 hover:bg-rb-200 dark:hover:bg-rb-800 aria-expanded:bg-rb-200 dark:aria-expanded:bg-rb-800 transition-colors cursor-pointer text-rb-text-500 shrink-0"
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
