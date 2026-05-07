"use client";

import { useEffect, useRef, useState } from "react";

/** Renders an inline SVG slide once the container scrolls into view. */
export function SlideAnimation({ slidePath }: { slidePath: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    fetch(slidePath).then((r) => r.text()).then(setSvg);
  }, [slidePath]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !svg || !inView) return;
    el.innerHTML = svg;
  }, [svg, inView]);

  return (
    <div
      ref={containerRef}
      style={{ width: 600, height: 450, overflow: "hidden", borderRadius: 12 }}
    />
  );
}
