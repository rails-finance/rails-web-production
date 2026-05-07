/** Shared session types and localStorage helpers.
 *  Ported from rails-explorer's `packages/shared/src/sessions.ts` —
 *  single-protocol focused, but the type still carries an optional
 *  `protocols` list so the same WalletSession storage shape works
 *  if the umbrella ever shares with sub-apps. */

export const SESSIONS_KEY = "defi-explorer-sessions";

export interface WalletSession {
  key: string;
  addresses: string[];
  ensNames: Record<string, string | null>;
  lastVisited: number;
  protocols?: string[];
  pinned?: boolean;
  preset?: boolean;
  /** User-provided display name, overrides ENS / short address. */
  customName?: string;
}

/** DOM event dispatched after any same-tab session mutation, so listeners
 *  can resync without polling. The native `storage` event only fires across
 *  tabs. */
export const SESSIONS_CHANGED_EVENT = "rails-sessions-changed";

export function loadSessions(storageKey = SESSIONS_KEY): WalletSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    return JSON.parse(raw) as WalletSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WalletSession[], storageKey = SESSIONS_KEY): void {
  if (typeof window === "undefined") return;
  try {
    if (sessions.length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(sessions));
    window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function renameSession(key: string, customName: string, storageKey = SESSIONS_KEY): void {
  const sessions = loadSessions(storageKey);
  const target = sessions.find((s) => s.key === key);
  if (!target) return;
  const trimmed = customName.trim();
  if (trimmed) target.customName = trimmed;
  else delete target.customName;
  saveSessions(sessions, storageKey);
}

export function upsertSession(
  addresses: string[],
  ensNames: Record<string, string | null>,
  protocols?: string[],
  storageKey = SESSIONS_KEY,
): void {
  const sessions = loadSessions(storageKey);
  const key = addresses.join("+");
  const existing = sessions.find((s) => s.key === key);
  if (existing) {
    existing.lastVisited = Date.now();
    existing.ensNames = { ...existing.ensNames, ...ensNames };
    if (protocols) existing.protocols = protocols;
  } else {
    sessions.unshift({
      key,
      addresses,
      ensNames,
      lastVisited: Date.now(),
      protocols,
    });
  }
  // Keep max 20 sessions
  saveSessions(sessions.slice(0, 20), storageKey);
}

export function timeAgo(epoch: number): string {
  const sec = Math.floor((Date.now() - epoch) / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
