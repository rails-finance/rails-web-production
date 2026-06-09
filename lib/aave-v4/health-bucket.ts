// Shared health-factor → status-pill bucketing for Aave V4 position cards.
// Both the listing card and the detail card consume this so their status
// pills speak the same vocabulary (NO DEBT / OPEN / UNDERWATER).
//
// The vocabulary is deliberately limited to factual states, not risk
// judgements: NO DEBT (nothing borrowed), OPEN (active, above the liquidation
// threshold), UNDERWATER (HF < 1 — liquidatable, a hard on-chain fact). Rails
// does not editorialize where within the open band a position sits with words
// like "cautious" or "at risk"; the HF value and headroom % carry that meaning.
//
// Color is intentionally neutral across every bucket too — no red/amber/green
// valence. Every pill renders in the same neutral surface token; the value
// color is plain foreground.

export interface HealthBucket {
  pillLabel: string;
  pillClass: string;
  valueColor: string;
}

// Single neutral pill style shared by every bucket — distinguished by label,
// not hue.
const NEUTRAL_PILL = "bg-rb-300 dark:bg-rb-700 text-foreground/80 dark:text-foreground/60";

export function bucketForHealth(hf: number | null): HealthBucket {
  if (hf == null) {
    return { pillLabel: "NO DEBT", pillClass: NEUTRAL_PILL, valueColor: "text-rb-500" };
  }
  if (hf >= 1.0) {
    return { pillLabel: "OPEN", pillClass: NEUTRAL_PILL, valueColor: "text-foreground/80" };
  }
  return { pillLabel: "UNDERWATER", pillClass: NEUTRAL_PILL, valueColor: "text-foreground/80" };
}
