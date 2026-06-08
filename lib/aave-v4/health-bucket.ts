// Shared health-factor → status-pill bucketing for Aave V4 position cards.
// Both the listing card and the detail card consume this so their status
// pills speak the same vocabulary (NO DEBT / OPEN / CAUTIOUS / AT RISK /
// UNDERWATER).
//
// Color is intentionally neutral across every bucket: Rails does not
// editorialize a position's risk with red/amber/green valence — the word
// ("CAUTIOUS", "UNDERWATER") and the numbers (HF value, headroom %) carry the
// meaning. Every pill renders in the same neutral surface token; the value
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
  if (hf >= 1.5) {
    return { pillLabel: "OPEN", pillClass: NEUTRAL_PILL, valueColor: "text-foreground/80" };
  }
  if (hf >= 1.1) {
    return { pillLabel: "CAUTIOUS", pillClass: NEUTRAL_PILL, valueColor: "text-foreground/80" };
  }
  if (hf >= 1.0) {
    return { pillLabel: "AT RISK", pillClass: NEUTRAL_PILL, valueColor: "text-foreground/80" };
  }
  return { pillLabel: "UNDERWATER", pillClass: NEUTRAL_PILL, valueColor: "text-foreground/80" };
}
