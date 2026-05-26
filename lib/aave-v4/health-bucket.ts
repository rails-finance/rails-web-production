// Shared health-factor → status-pill bucketing for Aave V4 position cards.
// Both the listing card and the detail card consume this so their status
// pills speak the same vocabulary (NO DEBT / OPEN / CAUTIOUS / AT RISK /
// UNDERWATER) and their value colors match.

export interface HealthBucket {
  pillLabel: string;
  pillClass: string;
  valueColor: string;
}

export function bucketForHealth(hf: number | null): HealthBucket {
  if (hf == null) {
    return {
      pillLabel: "NO DEBT",
      pillClass: "bg-rb-300 dark:bg-rb-700 text-foreground/80 dark:text-foreground/60",
      valueColor: "text-rb-500",
    };
  }
  if (hf >= 1.5) {
    return {
      pillLabel: "OPEN",
      pillClass: "text-white bg-green-500 dark:bg-green-950 dark:text-green-500/70",
      valueColor: "text-foreground",
    };
  }
  if (hf >= 1.1) {
    return {
      pillLabel: "CAUTIOUS",
      pillClass: "text-white bg-amber-500 dark:bg-amber-950 dark:text-amber-500/70",
      valueColor: "text-amber-400",
    };
  }
  if (hf >= 1.0) {
    return {
      pillLabel: "AT RISK",
      pillClass: "text-white bg-orange-500 dark:bg-orange-950 dark:text-orange-500/70",
      valueColor: "text-orange-400",
    };
  }
  return {
    pillLabel: "UNDERWATER",
    pillClass: "text-white bg-red-500 dark:bg-red-950 dark:text-red-500/70",
    valueColor: "text-red-400",
  };
}
