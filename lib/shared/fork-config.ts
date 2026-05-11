// Stub for rails-explorer's Liquity-fork registry.
//
// In rails-explorer this file declares the Asymmetry / DeFi Dollar / Ebisu
// fork protocols (collateral lists, contract addresses, stablecoins). The
// universal event-card system reads `FORK_ALL_IDS` to recognise fork events
// as Liquity-style troves.
//
// rails-web-mig is liquity-v2 only; no forks ship here yet. Phase 1 sub-step
// keeps this as an empty Set so `useLiquityTroveBars` only matches the
// canonical `liquity-v2-troves` protocol id. Add fork ids here when they
// arrive in the migration.

export const FORK_ALL_IDS = new Set<string>();
