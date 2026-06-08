import type { ReactNode } from "react";

interface StatValueProps {
  children: ReactNode;
  title?: string;
  color?: string;
  className?: string;
}

export function StatValue({
  children,
  title,
  // Muted-but-prominent default so every big value shares one tone across both
  // protocols and pairs with the muted (rb-500) labels. Responsive size:
  // text-2xl on small/medium (keeps Aave's icon-laden values from crowding the
  // 4-col row), text-3xl on large for the bigger desktop feel.
  color = "text-foreground/80",
  className,
}: StatValueProps) {
  return (
    <div
      className={`text-2xl lg:text-3xl font-bold tabular-nums mt-2 ${color}${className ? ` ${className}` : ""}`}
      title={title}
    >
      {children}
    </div>
  );
}

interface StatFootnoteProps {
  children: ReactNode;
  color?: string;
  bold?: boolean;
  title?: string;
}

export function StatFootnote({
  children,
  color = "text-rb-500",
  bold,
  title,
}: StatFootnoteProps) {
  return (
    <div
      className={`text-xs mt-0.5 ${color}${bold ? " font-medium" : ""}`}
      title={title}
    >
      {children}
    </div>
  );
}

export function StatDash({ children = "\u2014" }: { children?: ReactNode }) {
  return (
    <div className="text-2xl lg:text-3xl font-bold text-rb-500 mt-2">{children}</div>
  );
}
