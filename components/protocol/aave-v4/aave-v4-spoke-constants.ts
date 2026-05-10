// Aave V4 spoke metadata used both by the spoke card (heavy component) and by
// the wallet-timeline page header (just two map lookups). Splitting these out
// keeps the wallet-page chunk from pulling in `aave-spoke-card.tsx` and its
// transitive deps just to render a hub label.

export type HubTier = "Core" | "Plus" | "Prime";

export const HUB_COLORS: Record<HubTier, { text: string; bg: string }> = {
  Core:  { text: "text-blue-400",    bg: "bg-blue-500/15" },
  Plus:  { text: "text-amber-400",   bg: "bg-amber-500/15" },
  Prime: { text: "text-emerald-400", bg: "bg-emerald-500/15" },
};

export const SPOKE_HUB: Record<string, HubTier> = {
  Main:                "Core",
  Forex:               "Core",
  Gold:                "Core",
  "Ethena Correlated": "Plus",
  "Ethena Ecosystem":  "Plus",
  EtherFi:             "Plus",
  Kelp:                "Plus",
  Lido:                "Plus",
  Lombard:             "Plus",
  Bluechip:            "Prime",
};
