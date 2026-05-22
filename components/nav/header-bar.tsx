"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { Facehash } from "@/components/shared/facehash";
import {
  loadSessions,
  SESSIONS_CHANGED_EVENT,
  type SessionProtocol,
  type WalletSession,
} from "@/lib/shared/sessions";
import { useWalletContext } from "@/components/nav/wallet-context";

/** Routes that count as "inside the protocol" — keyed by the active protocol
 *  so the header can render the protocol label and the wallet pill. Marketing
 *  routes (home, about, blog, …) match nothing here, which keeps the chrome
 *  on those pages a single Rails wordmark — no protocol, no wallet, no cog. */
const PROTOCOL_CONTEXTS: {
  id: SessionProtocol;
  label: string;
  iconSrc: string;
  prefixes: string[];
}[] = [
  {
    id: "liquity-v2",
    label: "Liquity V2",
    iconSrc: "/icons/protocols/liquity.png",
    prefixes: ["/liquity-v2", "/trove"],
  },
  {
    id: "aave-v4",
    label: "Aave V4",
    iconSrc: "/icons/protocols/aave-v4.png",
    prefixes: ["/aave-v4"],
  },
];

function activeProtocol(pathname: string | null) {
  if (!pathname) return null;
  for (const ctx of PROTOCOL_CONTEXTS) {
    if (ctx.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return ctx;
    }
  }
  return null;
}

/** True when the current URL is bound to a specific wallet — a per-protocol
 *  wallet view or a trove detail page. The bare protocol listing
 *  (`/liquity-v2`, `/aave-v4`) is browsing the universe, not viewing a
 *  wallet, so the pill stays hidden there even when a wallet is "logged in"
 *  in localStorage. The pill reflects "you're viewing this wallet's
 *  positions on this rail," not "this wallet is remembered in localStorage."
 *  The cross-protocol umbrella was removed — each rail now stands alone. */
function isWalletScopedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // /liquity-v2/trove/[collateralType]/[troveId]
  if (/^\/liquity-v2\/trove\/[^/]+\/[^/]+\/?$/.test(pathname)) return true;
  // /liquity-v2/[wallet] and /aave-v4/[wallet] — but not the bare listing
  // (zero further segments) and not the `trove` intermediate.
  const m = pathname.match(/^\/(liquity-v2|aave-v4)\/([^/]+)\/?$/);
  if (m) {
    const second = m[2];
    if (second === "trove") return false;
    return true;
  }
  return false;
}

/** Always-on Rails wordmark on the left. Rails is the platform; the protocol
 *  pill (right of the wordmark) names the active rail when inside one. No
 *  "Explorer" sublabel — there isn't a single explorer, there are mono-rails. */
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
      <span className="text-base tracking-wide font-semibold opacity-80 group-hover:opacity-100 transition-opacity">
        Rails
      </span>
    </Link>
  );
}

/** Non-interactive protocol identity that sits inline to the right of the
 *  Rails wordmark when the user is inside a rail. Reads as "you're here",
 *  not "switch from here". Smaller, dimmed uppercase keeps the visual
 *  subordination — Rails is the brand, the protocol label names the rail.
 *  Protocol switching happens via the footer. */
function ProtocolLabel({
  protocol,
}: {
  protocol: { id: string; label: string; iconSrc: string };
}) {
  return (
    <div className="ml-3 flex items-center gap-1.5">
      <img
        src={protocol.iconSrc}
        alt=""
        className="w-4 h-4 shrink-0 rounded-[3px]"
      />
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-rb-500">
        {protocol.label}
      </span>
    </div>
  );
}

/** Look up the active session in localStorage so the wallet pill can show
 *  the user-set custom name without an API roundtrip. Reads only the active
 *  protocol's list — a rename done on /liquity-v2 doesn't surface on
 *  /aave-v4, and vice versa. Returns null when there's no active protocol
 *  (e.g. on marketing pages). */
function useActiveSession(
  addresses: string[],
  protocol: SessionProtocol | null,
): WalletSession | null {
  const key = useMemo(() => [...addresses].sort().join("+"), [addresses]);
  const [session, setSession] = useState<WalletSession | null>(null);

  useEffect(() => {
    if (!key || !protocol) {
      setSession(null);
      return;
    }
    const sync = () => {
      const found = loadSessions(protocol).find((s) => s.key === key) ?? null;
      setSession(found);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SESSIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, sync);
    };
  }, [key, protocol]);

  return session;
}

export function HeaderBar() {
  const { addresses, ensNames } = useWalletContext();
  const pathname = usePathname();
  const active = activeProtocol(pathname);

  const activeAddr = addresses[0];
  const activeSession = useActiveSession(addresses, active?.id ?? null);
  const triggerLabel =
    activeSession?.customName ||
    (activeAddr
      ? ensNames[activeAddr] || `${activeAddr.slice(0, 6)}…${activeAddr.slice(-4)}`
      : "");

  // Wallet pill renders only when there's an active address AND the current
  // URL is bound to a wallet on a specific rail (per-protocol wallet view
  // or trove detail). Bare protocol listings and marketing pages stay
  // pill-less. The cross-protocol umbrella is gone, so the pill always
  // points back at the *active rail's* view of this wallet.
  const showWalletPill =
    Boolean(activeAddr) && Boolean(active) && isWalletScopedRoute(pathname);

  return (
    <header className="relative z-40 mb-2">
      <div className="max-w-7xl mx-auto py-5 px-4 md:px-6 flex items-center gap-4">
        <div className="flex items-center shrink-0">
          <RailsLogo />
          {active && <ProtocolLabel protocol={active} />}
        </div>

        <div className="flex-1" />

        {showWalletPill && activeAddr && active && (
          <WalletPillLink
            activeAddr={activeAddr}
            triggerLabel={triggerLabel}
            protocol={active}
          />
        )}
      </div>
    </header>
  );
}

/** The active-wallet identity pill. Clicking navigates back to the active
 *  rail's wallet view — there's no cross-rail summary anymore, the pill is
 *  scoped to whichever protocol you're currently inside. */
function WalletPillLink({
  activeAddr,
  triggerLabel,
  protocol,
}: {
  activeAddr: string;
  triggerLabel: string;
  protocol: { id: SessionProtocol; label: string };
}) {
  return (
    <Link
      href={`/${protocol.id}/${activeAddr}`}
      className="group flex items-center gap-2 rounded-full px-3 py-2 hover:bg-rb-200/60 dark:hover:bg-rb-800/60 transition-colors cursor-pointer text-rb-text-500 shrink-0"
      title={`View this wallet on ${protocol.label}`}
    >
      <div className="rounded-md relative z-10">
        <Facehash address={activeAddr} size={16} />
      </div>
      <span className="text-xs font-semibold truncate max-w-[140px] hidden sm:inline text-rb-500 group-hover:text-foreground transition-colors">
        {triggerLabel}
      </span>
    </Link>
  );
}
