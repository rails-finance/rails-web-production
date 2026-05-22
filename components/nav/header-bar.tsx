"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SessionProtocol } from "@/lib/shared/sessions";

/** Routes that count as "inside the protocol" — keyed by the active protocol
 *  so the header can render the protocol label. Marketing routes (home,
 *  about, blog, …) match nothing here, which keeps the chrome on those pages
 *  a single Rails wordmark — no protocol label. */
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
    prefixes: ["/liquity-v2"],
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

/** Protocol identity inline to the right of the Rails wordmark when the user
 *  is inside a rail. Links back to the rail's listing page — useful from a
 *  deep view (trove or spoke detail) where it's the fastest jump back to the
 *  full set. Smaller, dimmed uppercase keeps the visual subordination —
 *  Rails is the brand, the protocol label names the rail. */
function ProtocolLabel({
  protocol,
}: {
  protocol: { id: string; label: string; iconSrc: string; prefixes: string[] };
}) {
  return (
    <Link
      href={protocol.prefixes[0]}
      className="group ml-3 flex items-center gap-1.5"
    >
      <img
        src={protocol.iconSrc}
        alt=""
        className="w-4 h-4 shrink-0 rounded-[3px]"
      />
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-rb-500 group-hover:text-foreground transition-colors">
        {protocol.label}
      </span>
    </Link>
  );
}

export function HeaderBar() {
  const pathname = usePathname();
  const active = activeProtocol(pathname);

  return (
    <header className="relative z-40 mb-2">
      <div className="max-w-7xl mx-auto py-5 px-4 md:px-6 flex items-center">
        <RailsLogo />
        {active && <ProtocolLabel protocol={active} />}
      </div>
    </header>
  );
}
