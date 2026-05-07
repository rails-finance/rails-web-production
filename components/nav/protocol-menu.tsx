"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FloatingPanel } from "@/components/shared/floating-panel";

type ProtocolEntry = {
  id: string;
  label: string;
  href: string;
  /** SVG <use> sprite id, e.g. "icon-liquity" */
  iconId: string;
  /** One-line description shown under the title in the dropdown entry. */
  subtitle: string;
};

/** Single-entry today; the type list is the surface to grow when sibling
 *  mono-rails come online. Click → navigate to that protocol's home. */
const PROTOCOLS: ProtocolEntry[] = [
  {
    id: "liquity-v2",
    label: "Liquity V2",
    href: "/liquity-v2",
    iconId: "icon-liquity",
    subtitle: "Borrow BOLD against ETH, wstETH, or rETH",
  },
];

export interface ProtocolMenuProps {
  anchor: HTMLElement | null;
  onClose: () => void;
}

export function ProtocolMenu({ anchor, onClose }: ProtocolMenuProps) {
  const pathname = usePathname();

  return (
    <FloatingPanel
      anchor={anchor}
      onClose={onClose}
      align="start"
      width={300}
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
                <Link
                  role="menuitem"
                  href={p.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                    active
                      ? "border-blue-500/50 bg-blue-500/[0.06] text-foreground"
                      : "border-transparent hover:border-rb-200 dark:hover:border-rb-700 hover:bg-rb-100 dark:hover:bg-rb-800 text-foreground"
                  }`}
                >
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-rb-100 dark:bg-rb-800 flex items-center justify-center overflow-hidden">
                    <svg
                      className="w-7 h-7"
                      viewBox="0 0 40 40"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <use href={`#${p.iconId}`} />
                    </svg>
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold leading-tight truncate">
                      {p.label}
                    </span>
                    <span className="text-xs text-rb-500 leading-snug truncate">
                      {p.subtitle}
                    </span>
                  </span>
                </Link>
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
