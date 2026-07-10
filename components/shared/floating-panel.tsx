"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface FloatingPanelProps {
  /** The element the panel is anchored to. When null, panel is closed. */
  anchor: HTMLElement | null;
  /** Optional element used for positioning only; `anchor` still drives open/close + outside-click. */
  positionAnchor?: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end" | "center";
  width?: number;
  minSpaceBelow?: number;
  closeOnScroll?: boolean;
  className?: string;
  ariaLabel?: string;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
}

const MARGIN = 8;
const VIEWPORT_PAD = 12;

/**
 * Floating panel anchored to a trigger element. Portals to document.body,
 * dismisses on ESC / outside click / (optionally) scroll.
 */
export function FloatingPanel({
  anchor,
  positionAnchor,
  onClose,
  children,
  align = "end",
  width = 360,
  minSpaceBelow = 320,
  closeOnScroll = true,
  className = "",
  ariaLabel,
  onPanelMouseEnter,
  onPanelMouseLeave,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const positionSource = positionAnchor ?? anchor;
  const [rect, setRect] = useState<DOMRect | null>(() => positionSource?.getBoundingClientRect() ?? null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!positionSource) {
      setRect(null);
      return;
    }
    const update = () => setRect(positionSource.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [positionSource]);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (e.target instanceof Node && (panelRef.current.contains(e.target) || anchor.contains(e.target))) {
        return;
      }
      onClose();
    };
    const onScroll = () => {
      if (closeOnScroll) onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => window.addEventListener("pointerdown", onClick), 0);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClick);
      window.removeEventListener("scroll", onScroll, true);
      clearTimeout(t);
    };
  }, [anchor, onClose, closeOnScroll]);

  const { style, placeBelow } = useMemo(() => {
    if (!rect) return { style: null, placeBelow: true };
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const w = Math.min(width, vw - 2 * VIEWPORT_PAD);

    let left: number;
    if (align === "start") left = rect.left;
    else if (align === "center") left = rect.left + rect.width / 2 - w / 2;
    else left = rect.right - w;
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - w - VIEWPORT_PAD));

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const placeBelow = spaceBelow >= minSpaceBelow || spaceBelow >= spaceAbove;

    const top = placeBelow ? rect.bottom + scrollY + MARGIN : rect.top + scrollY - MARGIN;

    return {
      style: {
        position: "absolute" as const,
        left: left + scrollX,
        top,
        transform: placeBelow ? undefined : "translateY(-100%)",
        width: w,
        zIndex: 80,
      },
      placeBelow,
    };
  }, [rect, align, width, minSpaceBelow]);

  if (!anchor || !mounted || !style) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      onMouseEnter={onPanelMouseEnter}
      onMouseLeave={onPanelMouseLeave}
      style={{ ...style, color: "var(--rb-text-500)" }}
      className={`rounded-xl border border-rb-200 dark:border-rb-800 shadow-2xl bg-white dark:bg-rb-850 ${placeBelow ? "animate-dropdown-down" : "animate-dropdown-up"} ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
