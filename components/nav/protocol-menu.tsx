"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FloatingPanel } from "@/components/shared/floating-panel";

type ProtocolEntry = {
  id: string;
  label: string;
  href: string;
  /** Square PNG asset under /public/icons/protocols/. Renders as a rounded
   *  square (app-icon convention; tokens use circular SVGs instead). */
  iconSrc: string;
  /** One-line description shown under the title in the dropdown entry. */
  subtitle: string;
  /** Whether this protocol exposes a preferences surface. When true, a cog
   *  button renders inline on the entry; click → onOpenPreferences(id). */
  hasPreferences?: boolean;
};

/** Single-entry today; the type list is the surface to grow when sibling
 *  mono-rails come online. Click → navigate to that protocol's home; the cog
 *  opens that protocol's preferences modal. */
const PROTOCOLS: ProtocolEntry[] = [
  {
    id: "liquity-v2",
    label: "Liquity V2",
    href: "/liquity-v2",
    iconSrc: "/icons/protocols/liquity.png",
    subtitle: "Borrow BOLD against ETH, wstETH, or rETH",
    hasPreferences: true,
  },
];

export interface ProtocolMenuProps {
  anchor: HTMLElement | null;
  /** Optional element used purely for positioning, so the protocol menu can
   *  align with the wallet menu (rails-explorer pattern). */
  positionAnchor?: HTMLElement | null;
  onClose: () => void;
  onOpenPreferences?: (protocolId: string) => void;
}

export function ProtocolMenu({ anchor, positionAnchor, onClose, onOpenPreferences }: ProtocolMenuProps) {
  const pathname = usePathname();

  return (
    <FloatingPanel
      anchor={anchor}
      positionAnchor={positionAnchor}
      onClose={onClose}
      width={320}
      minSpaceBelow={140}
      ariaLabel="Switch protocol"
    >
      <div className="py-2">
        <div className="px-3 pt-1 pb-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-rb-500">
          Protocol
        </div>
        <ul role="menu" className="space-y-1 px-2">
          {PROTOCOLS.map((p) => {
            const active = pathname?.startsWith(p.href);
            return (
              <li key={p.id} role="none">
                <div
                  className={`flex items-stretch rounded-xl border transition-colors overflow-hidden ${
                    active
                      ? "border-blue-500/50 bg-blue-500/[0.06]"
                      : "border-transparent hover:border-rb-200 dark:hover:border-rb-700 hover:bg-rb-100 dark:hover:bg-rb-800"
                  }`}
                >
                  <Link
                    role="menuitem"
                    href={p.href}
                    onClick={onClose}
                    className="flex items-center gap-3 p-2.5 flex-1 min-w-0 text-foreground"
                  >
                    <img
                      src={p.iconSrc}
                      alt=""
                      className="w-10 h-10 shrink-0 rounded-xl"
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold leading-tight truncate">
                        {p.label}
                      </span>
                      <span className="text-xs text-rb-500 leading-snug truncate">
                        {p.subtitle}
                      </span>
                    </span>
                  </Link>
                  {p.hasPreferences && onOpenPreferences && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenPreferences(p.id);
                        onClose();
                      }}
                      aria-label={`${p.label} preferences`}
                      title={`${p.label} preferences`}
                      className="shrink-0 w-10 flex items-center justify-center text-rb-500 hover:text-foreground hover:bg-rb-200/60 dark:hover:bg-rb-700/60 transition-colors cursor-pointer border-l border-rb-200/60 dark:border-rb-800/60"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
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
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="px-3 pt-2.5 pb-1 text-[10px] text-rb-500 leading-snug">
          More protocols coming soon.
        </div>
      </div>
    </FloatingPanel>
  );
}
