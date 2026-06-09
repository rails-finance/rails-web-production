"use client";

/**
 * FilterSections — one dropdown per dimension group (Risk / Market / Assets /
 * View), shown up top alongside search + sort. Each group button opens a single
 * panel listing every dimension in that group with its options inline (radio for
 * single-select, checkbox for multi) — no second-level drill-in. A group whose
 * any dimension is active reads as "on" (the active control styling) so you can
 * see which sections carry filters at a glance; the removable chips live
 * separately in <FilterChips>.
 *
 * Like the rest of the filter grammar this holds no filter state — it reads and
 * writes the rail's URL-backed param object through the dimension registry
 * (see ./types).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON, RESET_LINK } from "@/lib/shared/ui-grammar";
import { type FilterDimension, type FilterOptionDef, isDimensionActive } from "@/components/shared/filter-bar/types";

interface FilterSectionsProps<F> {
  dimensions: FilterDimension<F>[];
  filters: F;
  onChange: (next: F) => void;
}

interface Group<F> {
  name: string;
  dims: FilterDimension<F>[];
}

/** Bucket dimensions by `group`, preserving registry order both across groups
 *  and within each. Dimensions hidden by `available` are dropped; an emptied
 *  group disappears. Ungrouped dimensions collect under a single "Filter" tab. */
function groupDimensions<F>(dims: FilterDimension<F>[], filters: F): Group<F>[] {
  const order: string[] = [];
  const byName = new Map<string, FilterDimension<F>[]>();
  for (const d of dims) {
    if (d.available && !d.available(filters)) continue;
    const name = d.group ?? "Filter";
    if (!byName.has(name)) {
      byName.set(name, []);
      order.push(name);
    }
    byName.get(name)!.push(d);
  }
  return order.map((name) => ({ name, dims: byName.get(name)! }));
}

export function FilterSections<F>({ dimensions, filters, onChange }: FilterSectionsProps<F>) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openGroup]);

  // Apply a value pick. Single: toggle (re-picking the sole selection clears it
  // to the dimension default), panel stays open so adjacent dimensions can be
  // set in one visit. Multi: toggle the value.
  const pickValue = (dim: FilterDimension<F>, value: string) => {
    const cur = dim.get(filters);
    if (dim.cardinality === "single") {
      const isSel = cur.length === 1 && cur[0] === value;
      onChange(dim.set(filters, isSel ? (dim.defaultValues?.(filters) ?? []) : [value]));
    } else {
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      onChange(dim.set(filters, next));
    }
  };

  const clearDim = (dim: FilterDimension<F>) => onChange(dim.set(filters, dim.defaultValues?.(filters) ?? []));

  const groups = groupDimensions(dimensions, filters);

  return (
    <div className="flex flex-wrap items-center gap-2" ref={ref}>
      {groups.map((group) => {
        const open = openGroup === group.name;
        const groupActive = group.dims.some((d) => isDimensionActive(d, filters));
        return (
          <div key={group.name} className="relative">
            <button
              type="button"
              onClick={() => setOpenGroup((g) => (g === group.name ? null : group.name))}
              className={`${CTRL_GHOST} ${open || groupActive ? CTRL_ON : CTRL_OFF} h-8 gap-1.5 px-3 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500`}
              aria-expanded={open}
            >
              <span>{group.name}</span>
              {groupActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />}
              <ChevronDown
                className={`w-3.5 h-3.5 text-rb-500 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {open && (
              <div
                className="absolute top-full left-0 mt-2 z-50 min-w-[220px] max-h-[420px] overflow-y-auto overlay-panel py-1"
                role="menu"
              >
                {group.dims.map((dim, i) => {
                  const selected = new Set(dim.get(filters));
                  const active = isDimensionActive(dim, filters);
                  // A single-dimension group is already named by its button, so
                  // its label header is redundant — drop it, keeping the row only
                  // to host the Clear link when active.
                  const showLabel = group.dims.length > 1;
                  return (
                    <div key={dim.id}>
                      {i > 0 && <div className="my-1 mx-3 border-t border-rb-300 dark:border-rb-700" />}
                      {(showLabel || active) && (
                        <div className="flex items-center justify-between px-4 pt-2 pb-1">
                          {showLabel ? (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-rb-500">
                              {dim.label}
                            </span>
                          ) : (
                            <span />
                          )}
                          {active && (
                            <button type="button" onClick={() => clearDim(dim)} className={RESET_LINK}>
                              Clear
                            </button>
                          )}
                        </div>
                      )}
                      {dim.options.map((opt) => (
                        <OptionRow
                          key={opt.value}
                          opt={opt}
                          multi={dim.cardinality === "multi"}
                          checked={selected.has(opt.value)}
                          onClick={() => pickValue(dim, opt.value)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OptionRow({
  opt,
  multi,
  checked,
  onClick,
}: {
  opt: FilterOptionDef;
  multi: boolean;
  checked: boolean;
  onClick: () => void;
}): ReactNode {
  // Mirror the sort dropdown: inset, rounded `overlay-item` rows, the selected
  // state carried by `overlay-item-active` plus a trailing check.
  return (
    <button
      type="button"
      onClick={onClick}
      className={`overlay-item ${checked ? "overlay-item-active" : ""} focus:outline-none focus:ring-2 focus:ring-blue-500`}
      role={multi ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={checked}
    >
      {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
      <span className="flex-1 text-left truncate">{opt.label}</span>
      {checked && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
    </button>
  );
}
