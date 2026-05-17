"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FloatingPanel } from "@/components/shared/floating-panel";
import { Facehash } from "@/components/shared/facehash";
import { ProtocolSearchBar } from "@/components/shared/protocol-search-bar";
import {
  loadSessions,
  renameSession,
  saveSessions,
  SESSIONS_CHANGED_EVENT,
  type WalletSession,
} from "@/lib/shared/sessions";
import { useWalletContext } from "@/components/nav/wallet-context";

interface WalletMenuProps {
  anchor: HTMLElement | null;
  positionAnchor?: HTMLElement | null;
  onClose: () => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
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
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}

function CurrentHeading({ session }: { session: WalletSession }) {
  const primary = session.addresses[0];
  const ens = session.ensNames[primary] || null;
  const fallback = ens || `${primary.slice(0, 6)}…${primary.slice(-4)}`;
  const label = session.customName || fallback;

  return (
    <div className="flex items-center gap-2.5 px-1 pt-1">
      <div
        style={{ borderRadius: 8, boxShadow: "0 0 0 2px var(--facehash-ring)" }}
        className="shrink-0"
      >
        <Facehash address={primary} size={32} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-foreground truncate">{label}</div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] font-mono text-rb-500 truncate" title={primary}>
            {primary}
          </span>
          <CopyButton text={primary} />
        </div>
      </div>
    </div>
  );
}

function RichSessionCard({
  session,
  isCurrent,
  href,
  onTogglePin,
  onRemove,
  onRename,
  onNavigate,
}: {
  session: WalletSession;
  isCurrent: boolean;
  href: string;
  onTogglePin: (key: string) => void;
  onRemove: (key: string) => void;
  onRename: (key: string, customName: string) => void;
  onNavigate: () => void;
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

  const avatar = (
    <div
      style={{ borderRadius: 5, boxShadow: "0 0 0 2px var(--facehash-ring)" }}
      className="shrink-0"
    >
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
      className="flex-1 min-w-0 text-xs font-bold px-1.5 py-0.5 rounded bg-rb-100 dark:bg-rb-900 border border-rb-300 dark:border-rb-700 outline-none"
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
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        }
      />
      <VerbButton
        onClick={() => onTogglePin(session.key)}
        title={session.pinned ? "Unpin" : "Pin"}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={session.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
          </svg>
        }
      />
    </div>
  );

  const rowClasses = `group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors border ${
    isCurrent
      ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
      : "border-transparent hover:border-blue-500 hover:bg-rb-100 dark:hover:bg-rb-900"
  }`;

  // The avatar+label area is the navigable target; the verb buttons sit
  // alongside it so their click handlers fire reliably. Nesting <button>
  // inside <a> is invalid HTML and was eating the pin/delete/rename clicks.
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
      <Link
        href={href}
        onClick={onNavigate}
        draggable={false}
        className="flex items-center gap-2.5 flex-1 min-w-0"
      >
        {avatar}
        {labelEl}
      </Link>
      {verbButtons}
    </div>
  );
}

export function WalletMenu({
  anchor,
  positionAnchor,
  onClose,
  onPanelMouseEnter,
  onPanelMouseLeave,
}: WalletMenuProps) {
  const { addresses: activeAddresses } = useWalletContext();
  const activeKey = [...activeAddresses].sort().join("+");
  const [sessions, setSessions] = useState<WalletSession[]>([]);
  const [tab, setTab] = useState<"pinned" | "recent">("recent");

  useEffect(() => {
    if (!anchor) return;
    setSessions(loadSessions());
    const sync = () => setSessions(loadSessions());
    window.addEventListener("storage", sync);
    window.addEventListener(SESSIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SESSIONS_CHANGED_EVENT, sync);
    };
  }, [anchor]);

  const togglePin = useCallback((key: string) => {
    setSessions((prev) => {
      const target = prev.find((s) => s.key === key);
      if (!target) return prev;
      const toggled = { ...target, pinned: !target.pinned };
      const rest = prev.filter((s) => s.key !== key);
      const next = [...rest.filter((s) => s.pinned), toggled, ...rest.filter((s) => !s.pinned)];
      saveSessions(next);
      return next;
    });
  }, []);

  const removeSession = useCallback((key: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.key !== key);
      saveSessions(next);
      return next;
    });
  }, []);

  const renameSessionLocal = useCallback((key: string, customName: string) => {
    renameSession(key, customName);
    setSessions(loadSessions());
  }, []);

  const { currentSession, pinnedList, recentList } = useMemo(() => {
    const current = sessions.find((s) => s.key === activeKey) ?? null;
    const byVisitedDesc = (a: WalletSession, b: WalletSession) =>
      b.lastVisited - a.lastVisited;
    return {
      currentSession: current,
      pinnedList: sessions.filter((s) => s.pinned).sort(byVisitedDesc),
      recentList: sessions.filter((s) => !s.pinned).sort(byVisitedDesc),
    };
  }, [sessions, activeKey]);

  useEffect(() => {
    if (tab === "recent" && recentList.length === 0 && pinnedList.length > 0) {
      setTab("pinned");
    } else if (tab === "pinned" && pinnedList.length === 0 && recentList.length > 0) {
      setTab("recent");
    }
  }, [tab, pinnedList.length, recentList.length]);

  if (!anchor) return null;

  const visible = tab === "pinned" ? pinnedList : recentList;
  const hasAny = sessions.length > 0;

  return (
    <FloatingPanel
      anchor={anchor}
      positionAnchor={positionAnchor}
      onClose={onClose}
      onPanelMouseEnter={onPanelMouseEnter}
      onPanelMouseLeave={onPanelMouseLeave}
      width={400}
      minSpaceBelow={420}
      closeOnScroll={false}
      ariaLabel="Wallet menu"
    >
      <div className="p-3 space-y-3">
        {currentSession && <CurrentHeading session={currentSession} />}

        <ProtocolSearchBar compact onAfterSubmit={onClose} />

        {hasAny && (
          <div className="flex items-center gap-1 border-b border-rb-200 dark:border-rb-800">
            <TabButton
              active={tab === "pinned"}
              onClick={() => setTab("pinned")}
              label="Pinned"
              count={pinnedList.length}
            />
            <TabButton
              active={tab === "recent"}
              onClick={() => setTab("recent")}
              label="Recent"
              count={recentList.length}
            />
          </div>
        )}

        {!hasAny ? (
          <p className="text-xs font-semibold text-rb-500 dark:text-rb-400 py-2">
            No recent sessions. Wallets you visit will appear here.
          </p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-rb-500 py-2">
            {tab === "pinned" ? "No pinned wallets yet." : "No recent wallets."}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {visible.map((s) => (
              <RichSessionCard
                key={s.key}
                session={s}
                isCurrent={s.key === activeKey}
                /* Every session click lands on the cross-rail umbrella, which
                 * shows the wallet across every protocol it has positions in.
                 * From there the user clicks into a specific rail. Sessions
                 * always store one lowercase 0x address as the primary key. */
                href={`/wallet/${s.addresses[0]}`}
                onTogglePin={togglePin}
                onRemove={removeSession}
                onRename={renameSessionLocal}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </div>
    </FloatingPanel>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
        active ? "text-foreground" : "text-rb-500 hover:text-foreground"
      }`}
    >
      {label}
      <span className="ml-1.5 text-[10px] text-rb-500">{count}</span>
      {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-blue-500" />}
    </button>
  );
}
