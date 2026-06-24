/**
 * Editorial metadata for Aave V4 spokes.
 *
 * The position card shows numbers; this file carries the *narrative* — what
 * archetype each spoke is, which Hub holds collateral, which Hub backs the
 * borrow, and a plain-English description users can read without already
 * knowing V4's Hub/Spoke architecture.
 *
 * Architectural reality (current understanding):
 *   - Hubs are unified-liquidity tiers (Core / Plus / Prime).
 *   - Spokes are modular interfaces with rules. Most spokes pool collateral
 *     and borrows within a single Hub; some — like Bluechip — accept
 *     collateral in one Hub and draw borrows from another via a cross-hub
 *     credit line. Rate, when surfaced, layers a Hub base + Spoke risk
 *     premium; we don't decompose it live (that would require reads against
 *     multiple Hubs and Spoke IRM strategy contracts).
 *
 * The narratives below are best-effort editorial copy that should be reviewed
 * against current Aave V4 docs before going to production. Lines marked with
 * `// TODO copy:` are placeholder phrasing to revise.
 */

import type { HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";

// ── URL slugs ────────────────────────────────────────────────────────────────
// Canonical slug ↔ display-name map for `/aave-v4/spoke/[slug]/[wallet]`.
// The display name is what the API returns as `spokeName` (and what every
// other table in this file is keyed by); the slug is the lowercase kebab-cased
// form used in URLs so we don't ship `%20` in production paths.
//
// When a new spoke ships:
//   1. Add the row here.
//   2. Add a 308 redirect in next.config.ts from the encoded display name
//      shape, in case the spoke's name contains a space.
//   3. Mirror in SPOKE_META below if it needs editorial copy.
const SPOKE_SLUG_TO_NAME: Record<string, string> = {
  main: "Main",
  bluechip: "Bluechip",
  forex: "Forex",
  gold: "Gold",
  "ethena-correlated": "Ethena Correlated",
  "ethena-ecosystem": "Ethena Ecosystem",
  etherfi: "EtherFi",
  kelp: "Kelp",
  lido: "Lido",
  lombard: "Lombard BTC",
  treasury: "Treasury",
  "global-dollar": "Global Dollar",
};

const SPOKE_NAME_TO_SLUG: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SPOKE_SLUG_TO_NAME).map(([slug, name]) => [name, slug])),
  // Alias: the older "Lombard" label maps to the same slug as the API's
  // "Lombard BTC".
  Lombard: "lombard",
};

/** Convert a spoke display name to its URL slug. Returns null for unknown
 *  names so callers can decide whether to fall back (e.g. encodeURIComponent
 *  for a not-yet-listed spoke) rather than ship a bad URL. */
export function slugifySpoke(displayName: string): string | null {
  return SPOKE_NAME_TO_SLUG[displayName] ?? null;
}

/** Convert a URL slug to the canonical display name. Returns null when the
 *  slug isn't a known spoke. The page wrapper falls back to URL-decoding the
 *  raw param so legacy `%20`-shaped bookmarks still resolve until the 308s
 *  catch them. */
export function spokeFromSlug(slug: string): string | null {
  return SPOKE_SLUG_TO_NAME[slug] ?? null;
}

/** All known spoke slugs. Used to drive route-level redirects from the
 *  encoded-display-name form. */
export const SPOKE_SLUGS: ReadonlyArray<string> = Object.keys(SPOKE_SLUG_TO_NAME);

export type SpokeArchetype =
  /** General-purpose single-hub spoke. Collateral and borrows live in the
   *  same Hub; rate is Hub utilization + Spoke premium. */
  | "standard"
  /** Collateral lives in one Hub; borrow is drawn from another Hub's
   *  liquidity via a credit line capped by Hub-level safeguards. */
  | "cross-hub-credit"
  /** Correlated-asset basket with elevated LTV between assets (e-Mode lineage). */
  | "correlated"
  /** Capped exposure, narrow asset list. The Spoke itself is the isolation
   *  boundary in V4 — distinct from V3's per-asset isolation flag. */
  | "isolation"
  /** Partner / ecosystem bundle around a specific asset family. */
  | "ecosystem";

export interface SpokeMeta {
  name: string;
  archetype: SpokeArchetype;
  /** Where supplied collateral sits. */
  collateralHub: HubTier;
  /** Where the borrow draws liquidity from. Differs from `collateralHub`
   *  only on cross-hub-credit spokes. */
  borrowHub: HubTier;
  /** Plain-English narrative, rendered as a stack of sentences in the
   *  SpokeNarrativeBand. Keep each entry to one or two sentences. */
  narrative: string[];
  /** Optional structural disclosure about rate composition. Today we don't
   *  decompose live; this surfaces the layered nature of V4 borrow rates
   *  (Hub base + Spoke premium) without inventing numbers. */
  rateNote?: string;
}

const RATE_NOTE_CROSS_HUB =
  "Borrow rate combines Core Hub's utilization-driven base rate with this Spoke's risk premium. Higher-quality collateral earns a lower premium; the displayed total is the sum.";

export const SPOKE_META: Record<string, SpokeMeta> = {
  Main: {
    name: "Main",
    archetype: "standard",
    collateralHub: "Core",
    borrowHub: "Core",
    narrative: [
      "Aave V4's general-purpose Spoke on the Core Hub.",
      "Collateral and borrows share the same Hub; rates respond to Core Hub utilization.",
    ],
  },
  Bluechip: {
    name: "Bluechip",
    archetype: "cross-hub-credit",
    collateralHub: "Prime",
    borrowHub: "Core",
    narrative: [
      "Bluechip is a Prime Hub Spoke: collateral (wstETH, BTC variants) sits in Prime, but borrows are drawn from Core Hub liquidity over a cross-hub credit line.",
      "The rate here is favorable because high-quality bluechip collateral earns a low risk premium, layered on top of Core Hub's base rate.",
      "Liquidation parameters and the recovery health factor are Spoke-specific and may differ from other Spokes — Hub-level safeguards cap how much liquidity the Spoke can draw.",
      "A health factor in the mid-1s is normal here, not a sign of an overlevered position: the Spoke's liquidation thresholds keep some headroom in reserve at launch, so the displayed HF will sit lower than V3 users may expect for the same collateral mix.",
    ],
    rateNote: RATE_NOTE_CROSS_HUB,
  },
  Forex: {
    name: "Forex",
    archetype: "isolation",
    collateralHub: "Core",
    borrowHub: "Core",
    // TODO copy: confirm forex spoke parameters against current docs.
    narrative: [
      "Forex-focused Spoke on the Core Hub.",
      "Designed around FX-pegged collateral and stable borrow assets; risk parameters reflect a narrower volatility profile than the general Spoke.",
    ],
  },
  Gold: {
    name: "Gold",
    archetype: "isolation",
    collateralHub: "Core",
    borrowHub: "Core",
    // TODO copy: confirm gold spoke parameters.
    narrative: [
      "Gold-pegged Spoke on the Core Hub.",
      "Risk parameters are tuned to tokenized-gold collateral paired with stable borrow assets.",
    ],
  },
  "Ethena Correlated": {
    name: "Ethena Correlated",
    archetype: "correlated",
    collateralHub: "Plus",
    borrowHub: "Plus",
    // TODO copy: confirm ethena-correlated emode-style treatment.
    narrative: [
      "Correlated-asset Spoke on the Plus Hub.",
      "Higher LTV is available between correlated Ethena assets (USDe-related basket), reflecting their tight peg behavior — modeled along the same lines as V3's E-Mode.",
    ],
  },
  "Ethena Ecosystem": {
    name: "Ethena Ecosystem",
    archetype: "ecosystem",
    collateralHub: "Plus",
    borrowHub: "Plus",
    // TODO copy: confirm ethena-ecosystem scope.
    narrative: [
      "Ethena ecosystem Spoke on the Plus Hub.",
      "Bundles Ethena assets (USDe, sUSDe, related) with parameters tuned to that ecosystem's risk profile.",
    ],
  },
  EtherFi: {
    name: "EtherFi",
    archetype: "ecosystem",
    collateralHub: "Core",
    borrowHub: "Core",
    // TODO copy: confirm etherfi LRT scope and any cross-hub credit.
    narrative: [
      "EtherFi Spoke on the Core Hub.",
      "Built around weETH / EtherFi liquid-restaking collateral; parameters reflect LRT-specific risk.",
    ],
  },
  Kelp: {
    name: "Kelp",
    archetype: "ecosystem",
    collateralHub: "Core",
    borrowHub: "Core",
    // TODO copy: confirm kelp LRT scope.
    narrative: [
      "Kelp Spoke on the Core Hub.",
      "Built around rsETH / Kelp liquid-restaking collateral; parameters reflect LRT-specific risk.",
    ],
  },
  Lido: {
    name: "Lido",
    archetype: "ecosystem",
    collateralHub: "Core",
    borrowHub: "Core",
    // TODO copy: confirm lido LST scope.
    narrative: ["Lido Spoke on the Core Hub.", "Built around stETH / wstETH liquid-staking collateral."],
  },
  "Lombard BTC": {
    name: "Lombard BTC",
    archetype: "ecosystem",
    collateralHub: "Core",
    borrowHub: "Core",
    // TODO copy: confirm lombard BTC scope.
    narrative: [
      "Lombard BTC Spoke on the Core Hub.",
      "Built around LBTC / Lombard wrapped-BTC collateral; parameters reflect BTC-variant risk.",
    ],
  },
  "Global Dollar": {
    name: "Global Dollar",
    archetype: "ecosystem",
    collateralHub: "Paxos",
    borrowHub: "Paxos",
    // TODO copy: confirm Global Dollar / Paxos hub parameters against current docs.
    narrative: [
      "The Global Dollar Spoke on the new Paxos Hub — Aave V4's first liquidity hub built for the Global Dollar (USDG) ecosystem.",
      "Collateral is PT-USDG-24SEP2026, a Pendle principal token maturing 24 Sep 2026; against it you can borrow USDC and USDT from the Paxos Hub, plus USDG drawn from the Core Hub over a cross-hub credit line.",
      "Risk parameters are Spoke-specific — the PT's fixed-maturity discount and the Hub's caps shape the available leverage.",
    ],
  },
};

export function getSpokeMeta(name: string): SpokeMeta | null {
  const canonicalName = name === "Lombard" ? "Lombard BTC" : name;
  return SPOKE_META[canonicalName] ?? null;
}

export const ARCHETYPE_LABEL: Record<SpokeArchetype, string> = {
  standard: "Standard Spoke",
  "cross-hub-credit": "Cross-Hub Credit",
  correlated: "Correlated Spoke",
  isolation: "Isolation Spoke",
  ecosystem: "Ecosystem Spoke",
};

// A former `ARCHETYPE_ACCENT` map (per-archetype amber/violet/cyan/fuchsia tints)
// lived here but was never consumed — the archetype renders as a neutral label
// via ARCHETYPE_LABEL. It was removed to keep off-grammar color references out of
// the code; the archetype is identity, not a status, so it carries no color.
