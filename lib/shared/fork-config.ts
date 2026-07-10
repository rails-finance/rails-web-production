// Dormant registry: protocol ids that the Liquity V2 trove helpers
// (`trove-economics`, `useLiquityTroveBars`) should also treat as Liquity-style
// troves. Empty on purpose.
//
// This app ships liquity-v2 only — no Liquity forks — so nothing needs listing
// here, and the empty Set keeps those helpers matching just the canonical
// `liquity-v2-troves` protocol id. The `|| FORK_ALL_IDS.has(p)` branch is a
// seam for the day a fork should reuse the canonical liquity-v2 trove UI; add
// ids here then.

export const FORK_ALL_IDS = new Set<string>();
