import { createPublicClient, fallback, http, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

/**
 * Forward ENS resolution (name → address) for the listing pages' wallet
 * search. Server-only — keeps any RPC URL off the client and lets us cache
 * across requests within a server instance.
 *
 * Why forward resolution: the rails-server-production backend only matches ENS via a
 * reverse-resolution cache (address → primary name, populated at index time
 * with a 7-day TTL). That misses any wallet it hasn't indexed, or whose
 * primary name differs from what was typed. Resolving the name to an address
 * here and filtering by address is reliable for any wallet on chain.
 *
 * RPC: prefers `ENS_RPC_URL`, then falls back across public endpoints. ENS
 * lookups go through mainnet's Universal Resolver, which all of these support.
 */
const transports = [
  process.env.ENS_RPC_URL,
  "https://eth.llamarpc.com",
  "https://ethereum-rpc.publicnode.com",
  "https://cloudflare-eth.com",
]
  .filter((u): u is string => !!u)
  .map((u) => http(u));

const client = createPublicClient({
  chain: mainnet,
  transport: fallback(transports),
});

// Best-effort in-process cache. Hits live longer than misses so a typo'd or
// unregistered name doesn't pin a null for an hour, but a real name doesn't
// re-hit RPC on every keystroke-driven navigation.
const HIT_TTL_MS = 60 * 60 * 1000; // 1h
const MISS_TTL_MS = 5 * 60 * 1000; // 5m
const cache = new Map<string, { address: string | null; expires: number }>();

function isEnsName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower.endsWith(".eth") && lower.length >= 7; // ≥3 chars + ".eth"
}

/**
 * Resolve an ENS name to a checksummed address, or null if it doesn't
 * resolve (or isn't a `.eth` name). Never throws — RPC/parse failures
 * resolve to null so callers can fall back gracefully.
 */
export async function resolveEnsAddress(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (!isEnsName(key)) return null;

  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.address;

  let address: string | null = null;
  try {
    const resolved = await client.getEnsAddress({ name: normalize(key) });
    address = resolved ? getAddress(resolved) : null;
  } catch {
    address = null;
  }

  cache.set(key, {
    address,
    expires: Date.now() + (address ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return address;
}
