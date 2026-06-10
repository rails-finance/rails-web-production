"use client";

export function ExplainerList({ items, children }: { items: React.ReactNode[]; children?: React.ReactNode }) {
  if (items.length === 0 && !children) return null;
  return (
    <div className="py-3">
      {items.length > 0 && (
        <ul className="space-y-1.5 text-sm text-rb-500 list-disc list-outside pl-4">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}
