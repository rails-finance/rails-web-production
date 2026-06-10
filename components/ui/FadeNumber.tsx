"use client";

import { motion, AnimatePresence } from "framer-motion";

interface FadeNumberProps {
  value: number;
  formatFn?: (value: number) => string | number;
  decimals?: number;
  animateOnMount?: boolean;
}

export function FadeNumber({ value, formatFn, decimals = 2, animateOnMount = false }: FadeNumberProps) {
  const formattedValue = formatFn
    ? String(formatFn(value))
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      });

  return (
    // Stack the outgoing and incoming values in one grid cell so an update
    // cross-fades *in place*. The previous `mode="wait"` faded the old number
    // fully out to blank before fading the next one in — which read as a
    // flicker every time a snapshot value was replaced by its live RPC value
    // (the two are usually near-identical, so the blank gap was pure noise).
    // Overlapping in a single cell also means no layout shift during the swap.
    // `initial` on AnimatePresence is gated to animateOnMount so the very first
    // paint only fades when the caller opts in.
    <span className="inline-grid">
      <AnimatePresence initial={animateOnMount}>
        <motion.span
          key={formattedValue}
          className="col-start-1 row-start-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {formattedValue}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
