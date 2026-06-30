import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText, Activity } from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";

// Nav state grammar:
//   rest    → text-foreground; icons stay neutral rb-500 throughout
//   hover   → text → blue-500 (blue = "this goes somewhere")
//   current → text-rb-500 (muted, you can't navigate to where you are) + semibold
//             for a quiet "you are here" cue, not clickable
const NAV_LINK_REST = "font-medium text-foreground hover:text-blue-500";
const NAV_LINK_CURRENT = "font-semibold text-rb-500 pointer-events-none";

interface NavigationContentProps {
  onLinkClick?: () => void;
}

export function NavigationContent({ onLinkClick }: NavigationContentProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: <Home size={16} />,
    },
    {
      href: "/about",
      label: "About",
      icon: <Users size={16} />,
    },
    {
      href: "/pulse",
      label: "Pulse",
      icon: <Activity size={16} />,
    },
    {
      href: "/blog",
      label: "Blog",
      icon: <FileText size={16} />,
    },
  ];

  // The rails — grouped under their own "Explorers" heading and rendered with
  // the real protocol marks rather than colour tiles.
  const explorerItems: {
    href: string;
    label: string;
    iconSrc: string;
    badge?: string;
  }[] = [
    {
      href: "/aave-v4",
      label: "Aave V4",
      iconSrc: "/icons/protocols/aave-v4.png",
    },
    {
      href: "/liquity-v2",
      label: "Liquity V2",
      iconSrc: "/icons/protocols/liquity.png",
    },
  ];

  const isActiveHref = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      <div className="space-y-2">
        {navItems.map((item) => {
          const isActive = isActiveHref(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 text-lg py-2 transition-colors ${
                isActive ? NAV_LINK_CURRENT : NAV_LINK_REST
              }`}
              onClick={isActive ? undefined : onLinkClick}
            >
              <div className="flex p-1.5 text-rb-500">{item.icon}</div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="my-4 border-t border-rb-200 dark:border-rb-700"></div>

      {/* Explorers — the rails */}
      <div className="text-xs text-rb-500 uppercase tracking-wide mb-3">Explorers</div>
      <div className="space-y-2">
        {explorerItems.map((item) => {
          const isActive = isActiveHref(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 text-lg py-2 transition-colors ${
                isActive ? NAV_LINK_CURRENT : NAV_LINK_REST
              }`}
              onClick={isActive ? undefined : onLinkClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.iconSrc} alt="" className="h-7 w-7 shrink-0 rounded" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="my-4 border-t border-rb-200 dark:border-rb-700"></div>

      {/* Theme Toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">Theme</span>
        <ThemeToggle />
      </div>

      <div className="border-t border-rb-200 dark:border-rb-700 pt-4"></div>

      <div className="space-y-3">
        <div className="text-xs text-rb-500 uppercase tracking-wide mb-3">Connect With Us</div>
        <div className="flex items-center gap-4">
          <a
            href="https://x.com/rails_finance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rb-500 hover:text-pink-500 dark:hover:text-pink-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-pink-500 rounded"
            aria-label="Follow Rails on X"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://www.youtube.com/@rails_finance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rb-500 hover:text-pink-500 dark:hover:text-pink-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-pink-500 rounded"
            aria-label="Rails Finance on YouTube"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
          <a
            href="https://github.com/rails-finance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rb-500 hover:text-pink-500 dark:hover:text-pink-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-pink-500 rounded"
            aria-label="Rails Finance on GitHub"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <a
            href="https://t.me/railsfinance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rb-500 hover:text-pink-500 dark:hover:text-pink-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-pink-500 rounded"
            aria-label="Rails Finance on Telegram"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>
        </div>
      </div>
    </>
  );
}
