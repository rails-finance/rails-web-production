const TEAR_R = 7.5;

const NUB_PATH =
  "M 0 10 C 0.039 9.998 0.078 9.996 0.117 9.994 C 7.253 8.192 11.311 0.058 17.709 0.058 C 18.55 0.058 21.552 0.059 22.389 0.059 C 28.784 0.059 32.841 8.186 39.971 9.993 C 40.013 9.995 40.056 9.997 40.098 9.999 L 39.996 9.999 C 39.997 9.999 39.999 10 40 10 L 0 10 Z";

/**
 * Ticket-tear perforation between expandable tiers inside a card.
 * `half="top"` closes the bottom of one panel (includes dotted rule).
 * `half="bottom"` opens the next panel below.
 */
export function TearHalf({ half }: { half: "top" | "bottom" }) {
  const r = TEAR_R;
  return (
    <div className="relative overflow-hidden" style={{ height: r }}>
      <div
        className="absolute left-0 right-0"
        style={{ height: r * 2, top: half === "bottom" ? -r : 0 }}
      >
        <svg
          className="absolute left-0 top-0 z-20"
          width={r}
          height={r * 2}
          viewBox={`0 0 ${r} ${r * 2}`}
          aria-hidden="true"
        >
          <circle
            cx="0"
            cy={r}
            r={r}
            className="fill-rb-50 dark:fill-rb-600"
          />
        </svg>
        {half === "top" && (
          <div
            className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dotted border-rb-300 dark:border-rb-700"
            style={{ left: r + 4, right: r + 4 }}
          />
        )}
        <svg
          className="absolute right-0 top-0 z-20"
          width={r}
          height={r * 2}
          viewBox={`0 0 ${r} ${r * 2}`}
          aria-hidden="true"
        >
          <circle
            cx={r}
            cy={r}
            r={r}
            className="fill-rb-50 dark:fill-rb-600"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Nub — cupped SVG at the top of Column 2 that reaches above the card
 * to visually connect to the card above. Uses the card's own background
 * colour (tracks hover via `group-hover`).
 */
export function Nub() {
  return (
    <svg
      className="absolute left-1/2 -translate-x-1/2 z-10"
      style={{ top: "calc(-1 * (var(--card-pad) + 10px))" }}
      width="40"
      height="10"
      viewBox="0 0 40 10"
      aria-hidden="true"
    >
      <path
        d={NUB_PATH}
        className="fill-rb-50 dark:fill-rb-600"
      />
    </svg>
  );
}

/**
 * Bite — cupped SVG at the bottom of Column 2 that punches through
 * to the page background, creating the spine connector.
 */
export function Bite() {
  return (
    <svg
      className="absolute left-1/2 -translate-x-1/2 z-10"
      style={{ bottom: "calc(-1 * var(--card-pad))" }}
      width="40"
      height="10"
      viewBox="0 0 40 10"
      aria-hidden="true"
    >
      <path d={NUB_PATH} style={{ fill: "var(--background)" }} />
    </svg>
  );
}

/**
 * ArrowFromDot — directional arrow with a dot endpoint,
 * used in the icon column to indicate token flow direction.
 */
export function ArrowFromDot({ direction, size = 28 }: { direction: "left" | "right"; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-rb-500 shrink-0"
      style={{ transform: direction === "left" ? "rotate(-90deg)" : "rotate(90deg)" }}
      aria-hidden="true"
    >
      <path d="m5 9 7-7 7 7" />
      <path d="M12 22V2" />
    </svg>
  );
}

export { TEAR_R };
