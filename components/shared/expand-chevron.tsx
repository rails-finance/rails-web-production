export interface ExpandChevronProps {
  isOpen: boolean;
  /** Tailwind group-hover prefix the chevron lives inside, e.g. "evt", "card", "proto".
   *  The pill turns teal with a white icon on group hover — teal = in-place utility
   *  (expand/collapse is a disclosure, not navigation, so deliberately NOT blue). */
  group: string;
  size?: number;
  className?: string;
}

const GROUP_BG: Record<string, string> = {
  evt:   "group-hover/evt:bg-teal-500",
  card:  "group-hover/card:bg-teal-500",
  proto: "group-hover/proto:bg-teal-500",
};

export function ExpandChevron({ isOpen, group, size = 12, className }: ExpandChevronProps) {
  const bg = GROUP_BG[group] ?? "";
  return (
    <span className={`expand-chev inline-flex items-center justify-center p-1 rounded transition-colors ${bg} ${className ?? ""}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-rb-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
