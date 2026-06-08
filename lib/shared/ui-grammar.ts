// Consolidated interaction grammar — one visual affordance per meaning, so a
// control's appearance always tells the user what it does. Import these strings
// rather than hand-rolling hover/border treatments, so the language stays
// consistent as new surfaces are added.
//
// The three meanings:
//
//  1. NAVIGATION — a control (button or text) that takes you to another page.
//     Signalled by BLUE on hover (a blue border for buttons, blue text for
//     links). Blue is reserved exclusively for "this goes somewhere" — never
//     used for in-place toggles — so a blue hover edge always means navigation.
//
//  2. IN-PLACE CONTROL — sort / filter / date / display / chart toggles that
//     change the current view without leaving the page. "Reactive ghost": no
//     resting fill (just a muted icon/label), a soft surface fill appears on
//     hover, and a persistent fill marks the engaged/open state. Never a border
//     (borders mean navigation).
//
//  3. PASSIVE PILL — labels like "NO DEBT", durations, percentages. They keep a
//     soft resting fill but never react to hover. Because only passive pills
//     carry an always-on fill and only controls react to hover, the two never
//     read as the same thing. (Pills are styled at their call sites; there's no
//     token here — this comment documents the third leg of the grammar.)

// Dark-mode note: the app's dark page canvas is rb-800, so control fills go
// *lighter* in dark (rb-700/600) to read as a lift; light mode darkens slightly
// (rb-200/300) against the rb-50 canvas. This keeps the hover/engaged states
// visible on both the bare page and the rb-900 panels controls also sit on.

/** Button that navigates to another page. Blue border appears on hover. */
export const NAV_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-rb-200 dark:border-rb-800 bg-rb-50 dark:bg-rb-800 px-3 py-1.5 text-sm text-rb-500 hover:text-foreground hover:bg-rb-200/60 dark:hover:bg-rb-700/50 hover:border-blue-500 transition-colors cursor-pointer";

/** Text/inline link that navigates to another page. Turns blue on hover. */
export const NAV_LINK = "text-rb-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors";

/**
 * In-place control — structural base only (layout + transition). Pair with
 * exactly one state token (CTRL_OFF / CTRL_ON / CTRL_ON_ACCENT) so a single
 * hover-fill rule applies, then add size/shape utilities (e.g. `w-7 h-7
 * rounded-md`, `h-7 px-2.5 rounded-md text-xs`).
 */
export const CTRL_GHOST = "inline-flex items-center justify-center transition-colors cursor-pointer";

/** Idle in-place control: muted, gains a soft fill + foreground on hover. */
export const CTRL_OFF = "text-rb-500 hover:bg-rb-50 dark:hover:bg-rb-800 hover:text-foreground";

/** Engaged/open in-place control: persistent soft fill, still reacts on hover. */
export const CTRL_ON = "bg-rb-200 dark:bg-rb-700 text-foreground hover:bg-rb-300 dark:hover:bg-rb-600";

/** Engaged in-place control carrying a semantic accent (e.g. an active date filter). */
export const CTRL_ON_ACCENT = "bg-amber-500/15 text-amber-500 dark:text-amber-400 hover:bg-amber-500/25";

/**
 * Passive metadata pill — a soft, always-on chip that labels (duration, "ago",
 * counts). One height / radius / type size so adjacent pills line up, and never
 * a hover reaction (that's reserved for CTRL_* controls). Add a leading icon as
 * a child; the gap + symmetric padding keep its height matched to text-only
 * pills.
 */
export const PILL_META =
  "inline-flex items-center gap-1 rounded-full bg-rb-50 dark:bg-rb-800 px-2 py-0.5 text-xs text-rb-500";

/**
 * Count badge — a solid chip showing a count of active selections (e.g. the
 * number of engaged filter groups). Deliberately the highest-contrast chip in
 * the grammar because its whole job is to pull the eye to "you have N active".
 * One token so the badge reads identically everywhere a count appears — the
 * listing filter bar, the per-category multi-select pills, and the timeline
 * controls.
 */
export const COUNT_BADGE =
  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rb-500 text-foreground text-[10px] font-semibold";
