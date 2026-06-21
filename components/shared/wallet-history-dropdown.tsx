"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

import { Facehash } from "@/components/shared/facehash";
import {
  loadSessions,
  renameSession,
  saveSessions,
  SESSIONS_CHANGED_EVENT,
  type SessionProtocol,
  type WalletSession,
} from "@/lib/shared/sessions";

/** Most recent / most pins shown per tab. */
const MAX_PER_TAB = 10;

interface Props {
  /** Open/closed flag controlled by the parent (typically: focused && !value). */
  show: boolean;
  /** Closed when the user clicks outside this container or hits Escape. */
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Called with the session's primary lowercase 0x address. */
  onPick: (address: string) => void;
  /** Which protocol's session list to render. Each rail keeps its own — no
   *  shared cross-protocol history. */
  protocol: SessionProtocol;
}

/** Floating panel of recent/pinned wallets, anchored beneath the wallet
 *  search input on a protocol page. Each protocol has its own session list:
 *  visiting a wallet on /liquity-v2 does not surface it on /aave-v4 and
 *  vice versa. */
export function WalletHistoryDropdown({ show, containerRef, onClose, onPick, protocol }: Props) {
  const [sessions, setSessions] = useState<WalletSession[]>([]);
  const [tab, setTab] = useState<"pinned" | "recent">("pinned");
  // True once the user clicks a tab — after that we stop auto-defaulting so
  // their choice sticks. Reset each time the dropdown closes (below).
  const [tabPicked, setTabPicked] = useState(false);

  useEffect(() => {
    const sync = () => setSessions(loadSessions(protocol));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SESSIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, sync);
    };
  }, [protocol]);

  const { pinnedList, recentList } = useMemo(() => {
    const byVisitedDesc = (a: WalletSession, b: WalletSession) => b.lastVisited - a.lastVisited;
    return {
      pinnedList: sessions
        .filter((s) => s.pinned)
        .sort(byVisitedDesc)
        .slice(0, MAX_PER_TAB),
      recentList: sessions
        .filter((s) => !s.pinned)
        .sort(byVisitedDesc)
        .slice(0, MAX_PER_TAB),
    };
  }, [sessions]);

  // Default tab: Favourites when any exist, otherwise Recents. This only runs
  // until the user manually picks a tab (tabPicked) — after that their choice
  // is respected, so we never yank them off a tab they're reading. Switching
  // *within* a tab that later empties is fine: the empty-state placeholder
  // below covers it, we don't auto-flip mid-browse.
  useEffect(() => {
    if (!tabPicked) setTab(pinnedList.length > 0 ? "pinned" : "recent");
  }, [pinnedList.length, tabPicked]);

  // Re-default the next time the dropdown opens, so a session where the user
  // poked around in Recents doesn't pin them there forever.
  useEffect(() => {
    if (!show) setTabPicked(false);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onPointer = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [show, containerRef, onClose]);

  // Favouriting now happens on the position cards themselves (the star on each
  // listing row), not in this dropdown — the dropdown is a destination for
  // browsing Favourites / Recents, not the place you fiddle with pins. The
  // Remove (trash) action below still un-lists a wallet entirely, which is how
  // a favourite gets cleared from here.
  //
  // saveSessions runs *after* setSessions returns — calling it inside the
  // updater would put a side-effecting dispatchEvent in React's render path
  // (and double-fire it in strict mode), which is what produces the "cannot
  // update HeaderBar while rendering WalletHistoryDropdown" warning.
  const removeSessionLocal = useCallback(
    (key: string) => {
      const next = sessions.filter((s) => s.key !== key);
      setSessions(next);
      saveSessions(next, protocol);
    },
    [sessions, protocol],
  );

  const renameSessionLocal = useCallback(
    (key: string, customName: string) => {
      renameSession(key, customName, protocol);
      setSessions(loadSessions(protocol));
    },
    [protocol],
  );

  if (!show) return null;

  const hasAny = sessions.length > 0;
  const visible = tab === "pinned" ? pinnedList : recentList;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border border-rb-200 dark:border-rb-800 bg-white dark:bg-rb-900 shadow-lg overflow-hidden">
      <div className="p-3 space-y-3">
        {hasAny ? (
          <>
            <div className="flex items-center gap-1 border-b border-rb-200 dark:border-rb-800">
              <TabButton
                active={tab === "pinned"}
                onClick={() => {
                  setTabPicked(true);
                  setTab("pinned");
                }}
                label="Favourites"
                kind="pinned"
                count={pinnedList.length}
              />
              <TabButton
                active={tab === "recent"}
                onClick={() => {
                  setTabPicked(true);
                  setTab("recent");
                }}
                label="Recent"
                kind="recent"
                count={recentList.length}
              />
            </div>
            {visible.length === 0 ? (
              <p className="text-xs text-rb-500 py-2">
                {tab === "pinned" ? "No favourites yet — tap the star on a position card." : "No recent wallets."}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {visible.map((s) => (
                  <SessionRow
                    key={s.key}
                    session={s}
                    onRemove={removeSessionLocal}
                    onRename={renameSessionLocal}
                    onPick={onPick}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs font-semibold text-rb-500 py-2">
            No recent sessions. Wallets you visit will appear here.
          </p>
        )}
      </div>
    </div>
  );
}

function VerbButton({
  onClick,
  title,
  icon,
  danger = false,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`shrink-0 p-1.5 rounded-md cursor-pointer text-rb-500 transition-colors ${
        danger ? "hover:text-red-400" : "hover:text-rb-text-500"
      } hover:bg-rb-200 dark:hover:bg-rb-800`}
    >
      {icon}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy address"
      className="shrink-0 p-1 rounded-md cursor-pointer text-rb-500 hover:text-rb-text-500 hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors"
    >
      {copied ? (
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
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
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
        >
          <rect width="14" height="14" x="8" y="8" rx="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}

/** Tab-heading marker mirroring the listing-card affordances: a filled star
 *  for the Favourites tab (matching FavouriteStar's resting filled state) and a
 *  history clock for Recents. Colour is inherited from the tab so it tracks the
 *  active/inactive state. */
function RowKindIcon({ kind }: { kind: "pinned" | "recent" }) {
  if (kind === "pinned") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function SessionRow({
  session,
  onRemove,
  onRename,
  onPick,
}: {
  session: WalletSession;
  onRemove: (key: string) => void;
  onRename: (key: string, customName: string) => void;
  onPick: (address: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  const primary = session.addresses[0];
  const ens = session.ensNames[primary] || null;
  const fallback = ens || `${primary.slice(0, 6)}…${primary.slice(-4)}`;
  const label = session.customName || fallback;

  const startEdit = () => {
    setDraftName(session.customName ?? "");
    setEditing(true);
  };
  const commitEdit = () => {
    onRename(session.key, draftName);
    setEditing(false);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraftName("");
  };

  const rowClasses =
    "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors border border-transparent hover:border-blue-500 hover:bg-rb-100 dark:hover:bg-rb-900";

  const avatar = (
    <div style={{ borderRadius: 5, boxShadow: "0 0 0 2px var(--facehash-ring)" }} className="shrink-0">
      <Facehash address={primary} size={18} />
    </div>
  );

  const labelEl = editing ? (
    <input
      autoFocus
      value={draftName}
      onChange={(e) => setDraftName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitEdit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        }
      }}
      onBlur={commitEdit}
      placeholder={fallback}
      className="flex-1 min-w-0 text-xs font-bold px-1.5 py-0.5 rounded bg-raised border border-rb-300 dark:border-rb-700 outline-none"
    />
  ) : (
    <div className="text-xs font-bold truncate flex-1 text-foreground" title={primary}>
      {label}
    </div>
  );

  const verbButtons = (
    <div className="flex items-center gap-0.5 shrink-0">
      <CopyButton text={primary} />
      {!editing && (
        <VerbButton
          onClick={startEdit}
          title="Rename"
          icon={
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
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          }
        />
      )}
      <VerbButton
        onClick={() => onRemove(session.key)}
        title="Remove"
        danger
        icon={
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
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        }
      />
    </div>
  );

  if (editing) {
    return (
      <div className={rowClasses}>
        {avatar}
        {labelEl}
        {verbButtons}
      </div>
    );
  }

  return (
    <div className={rowClasses}>
      <button
        type="button"
        onClick={() => onPick(primary)}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
      >
        {avatar}
        {labelEl}
      </button>
      {verbButtons}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  kind,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  kind: "pinned" | "recent";
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
        active ? "text-foreground" : "text-rb-500 hover:text-foreground"
      }`}
    >
      <RowKindIcon kind={kind} />
      {label}
      <span className="text-[10px] text-rb-500">{count}</span>
      {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-blue-500" />}
    </button>
  );
}
