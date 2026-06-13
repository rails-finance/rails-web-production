"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NavigationContent } from "@/components/site/NavigationContent";

/**
 * The shared Rails navigation affordance: a hamburger button that reveals the
 * NavigationContent menu (colour-tiled links + theme toggle + socials). On
 * desktop it's a dropdown anchored under the button; on touch/small screens
 * it's a right-hand sidebar sheet. Lives in the global HeaderBar so the same
 * menu rides every route — marketing and app alike.
 *
 * Click-to-toggle on every breakpoint (ported from rails-explorer — no more
 * hover-to-open): the button toggles, an outside click or Escape closes, and
 * the desktop dropdown springs in with a small bounce on arrival.
 */
export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice || isSmallScreen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close on Escape, and on a click/tap outside the menu root.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  const toggleMenu = () => setIsOpen((v) => !v);
  const closeMenu = () => setIsOpen(false);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={toggleMenu}
        className="cursor-pointer rounded-lg p-2.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Toggle menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {/* Hamburger that morphs to an X */}
        <div className="relative flex h-5 w-6 flex-col justify-center">
          <span
            className={`absolute h-0.5 w-full bg-rb-700 transition-all duration-300 ease-in-out dark:bg-rb-300 ${
              isOpen ? "translate-y-0 rotate-45" : "-translate-y-2"
            }`}
          />
          <span
            className={`absolute h-0.5 w-full bg-rb-700 transition-all duration-300 ease-in-out dark:bg-rb-300 ${
              isOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute h-0.5 w-full bg-rb-700 transition-all duration-300 ease-in-out dark:bg-rb-300 ${
              isOpen ? "translate-y-0 -rotate-45" : "translate-y-2"
            }`}
          />
        </div>
      </button>

      {/* Desktop dropdown — springs in with a small bounce */}
      {!isMobile && (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 20, mass: 0.8 }}
              style={{ transformOrigin: "top right" }}
              className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-rb-200 bg-white p-6 shadow-2xl dark:border-rb-800 dark:bg-rb-900"
            >
              {/* Triangle pointer */}
              <div className="absolute -top-2 right-4 h-0 w-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white before:absolute before:-left-[9px] before:-top-[1px] before:h-0 before:w-0 before:border-l-[9px] before:border-r-[9px] before:border-b-[9px] before:border-l-transparent before:border-r-transparent before:border-b-white before:content-[''] dark:border-b-rb-900 dark:before:border-b-rb-900" />
              <NavigationContent onLinkClick={closeMenu} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile sidebar sheet */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={toggleMenu}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
              e.preventDefault();
              toggleMenu();
            }
          }}
          aria-label="Close menu"
        >
          <div
            className="fixed right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-white shadow-2xl dark:bg-rb-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-rb-200 p-6 dark:border-rb-700">
              <div className="flex items-center gap-1.5 text-foreground">
                <svg width={28} height={28} viewBox="0 0 200 200" fill="none" aria-hidden="true">
                  <path
                    fill="currentColor"
                    style={{ opacity: 0.85 }}
                    d="M 79.763 159.671 L 111.637 159.671 L 52.168 41.625 L 20.295 41.625 L 79.763 159.671 Z"
                  />
                  <path
                    fill="currentColor"
                    style={{ opacity: 0.85 }}
                    d="M 98.578 97.056 L 130.451 97.056 L 105.044 47.853 L 73.171 47.853 L 98.578 97.056 Z"
                  />
                  <path
                    fill="currentColor"
                    d="M 148.892 142.388 L 180.766 142.388 L 155.359 93.185 L 123.486 93.185 L 148.892 142.388 Z"
                  />
                </svg>
                <span className="text-lg font-semibold tracking-wide">Rails</span>
              </div>
              <button
                onClick={toggleMenu}
                className="cursor-pointer rounded-lg p-3 transition-colors duration-150 hover:bg-rb-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-rb-700"
                aria-label="Close menu"
              >
                <div className="relative flex h-5 w-6 flex-col justify-center">
                  <span className="absolute h-0.5 w-full rotate-45 bg-rb-700 dark:bg-rb-300" />
                  <span className="absolute h-0.5 w-full bg-rb-700 opacity-0 dark:bg-rb-300" />
                  <span className="absolute h-0.5 w-full -rotate-45 bg-rb-700 dark:bg-rb-300" />
                </div>
              </button>
            </div>
            <nav className="p-6">
              <NavigationContent onLinkClick={toggleMenu} />
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
