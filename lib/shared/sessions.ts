/** Per-protocol session helpers.
 *
 *  Each mono-rail (Liquity V2, Aave V4, …) keeps its own recent/pinned
 *  wallet list in its own localStorage key. There is no cross-protocol
 *  list — that's the whole point of the silo: visiting a wallet on one
 *  rail doesn't surface it as "recent" on another. The protocol arg on
 *  every function makes the scope explicit at the call site rather than
 *  hidden behind a deployment env var. */

export type SessionProtocol = "liquity-v2" | "aave-v4";

export interface WalletSession {
  key: string;
  addresses: string[];
  ensNames: Record<string, string | null>;
  lastVisited: number;
  pinned?: boolean;
  preset?: boolean;
  /** User-provided display name, overrides ENS / short address. */
  customName?: string;
}

/** DOM event dispatched after any same-tab session mutation, so listeners
 *  can resync without polling. The native `storage` event only fires across
 *  tabs. */
export const SESSIONS_CHANGED_EVENT = "rails-sessions-changed";

function storageKey(protocol: SessionProtocol): string {
  return `${protocol}-sessions`;
}

export function loadSessions(protocol: SessionProtocol): WalletSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(protocol));
    if (!raw) return [];
    return JSON.parse(raw) as WalletSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WalletSession[], protocol: SessionProtocol): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(protocol);
    if (sessions.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(sessions));
    // Defer dispatch to a microtask so callers that accidentally run from
    // inside a React render phase (e.g. a setState updater) don't trip
    // subscribers' setStates synchronously and produce a "cannot update X
    // while rendering Y" warning. localStorage is still written immediately.
    queueMicrotask(() => window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT)));
  } catch {
    /* ignore */
  }
}

export function renameSession(key: string, customName: string, protocol: SessionProtocol): void {
  const sessions = loadSessions(protocol);
  const target = sessions.find((s) => s.key === key);
  if (!target) return;
  const trimmed = customName.trim();
  if (trimmed) target.customName = trimmed;
  else delete target.customName;
  saveSessions(sessions, protocol);
}

export function upsertSession(
  addresses: string[],
  ensNames: Record<string, string | null>,
  protocol: SessionProtocol,
): void {
  const sessions = loadSessions(protocol);
  const key = addresses.join("+");
  const existing = sessions.find((s) => s.key === key);
  if (existing) {
    existing.lastVisited = Date.now();
    existing.ensNames = { ...existing.ensNames, ...ensNames };
  } else {
    sessions.unshift({
      key,
      addresses,
      ensNames,
      lastVisited: Date.now(),
    });
  }
  // Keep max 20 sessions per protocol — but favourites (pinned) are never
  // evicted by the cap. Trimming only sheds the oldest *unpinned* recents, so
  // a wallet a user explicitly favourited can't silently disappear once the
  // recents list grows past 20.
  const pinned = sessions.filter((s) => s.pinned);
  const recents = sessions.filter((s) => !s.pinned).slice(0, Math.max(0, 20 - pinned.length));
  // Preserve original ordering (pinned-or-not interleaved) rather than
  // segregating, so the dropdown's by-lastVisited sort stays the source of
  // truth for display order.
  const kept = new Set([...pinned, ...recents]);
  saveSessions(
    sessions.filter((s) => kept.has(s)),
    protocol,
  );
}

/** True when `address` is currently favourited (pinned) in this protocol's
 *  list. Matched case-insensitively against each session's primary address. */
export function isFavourite(address: string, protocol: SessionProtocol): boolean {
  const addr = address.toLowerCase();
  return loadSessions(protocol).some((s) => s.pinned && s.addresses[0]?.toLowerCase() === addr);
}

/** Toggle the favourite (pinned) state of a single wallet from anywhere — a
 *  listing card's star, the dropdown, etc. Unlike a plain in-place flag flip,
 *  this upserts: favouriting a wallet that was never "visited" creates its
 *  session on the fly so it shows in the Favourites tab immediately. Returns
 *  the resulting favourite state. */
export function toggleFavourite(address: string, ensName: string | null, protocol: SessionProtocol): boolean {
  const addr = address.toLowerCase();
  const sessions = loadSessions(protocol);
  const existing = sessions.find((s) => s.addresses[0]?.toLowerCase() === addr);
  let nowFavourite: boolean;
  if (existing) {
    nowFavourite = !existing.pinned;
    existing.pinned = nowFavourite;
    if (ensName && !existing.ensNames[existing.addresses[0]]) {
      existing.ensNames = { ...existing.ensNames, [existing.addresses[0]]: ensName };
    }
  } else {
    nowFavourite = true;
    sessions.unshift({
      key: addr,
      addresses: [addr],
      ensNames: { [addr]: ensName },
      lastVisited: Date.now(),
      pinned: true,
    });
  }
  saveSessions(sessions, protocol);
  return nowFavourite;
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
