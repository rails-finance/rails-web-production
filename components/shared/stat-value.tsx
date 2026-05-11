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
  color = "text-foreground",
  className,
}: StatValueProps) {
  return (
    <div
      className={`text-2xl font-bold tabular-nums mt-2 ${color}${className ? ` ${className}` : ""}`}
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
    <div className="text-2xl font-bold text-rb-500 mt-2">{children}</div>
  );
}
