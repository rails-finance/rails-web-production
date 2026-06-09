"use client";

/**
 * FilterBar — a quiet-at-rest, expressive-on-demand predicate filter bar.
 *
 * Resting state is a single low-emphasis `+ Filter` affordance — no pill row, no
 * count badge — so on a wallet-scoped listing the positions stay the content.
 * Engaging it reveals removable chips, one per active predicate, that AND
 * together and read in plain words. Driven entirely by a dimension registry
 * (see ./types) over the rail's URL-backed filter-param object; the bar keeps no
 * filter state of its own.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, X, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON, RESET_LINK } from "@/lib/shared/ui-grammar";
import {
  type FilterDimension,
  type FilterOptionDef,
  isDimensionActive,
  defaultChipLabel,
} from "@/components/shared/filter-bar/types";

interface FilterBarProps<F> {
  dimensions: FilterDimension<F>[];
  filters: F;
  onChange: (next: F) => void;
}

type View = { mode: "menu" } | { mode: "values"; dimId: string };

export function FilterBar<F>({ dimensions, filters, onChange }: FilterBarProps<F>) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ mode: "menu" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const activeDims = dimensions.filter((d) => isDimensionActive(d, filters));
  const menuDims = dimensions.filter((d) => d.available?.(filters) ?? true);
  const editing = view.mode === "values" ? dimensions.find((d) => d.id === view.dimId) : undefined;

  const openMenu = () => {
    setView({ mode: "menu" });
    setOpen((o) => !o);
  };
  const openValues = (dimId: string) => {
    setView({ mode: "values", dimId });
    setOpen(true);
  };

  const chipText = (dim: FilterDimension<F>) => {
    const vals = dim.get(filters);
    return dim.chipLabel ? dim.chipLabel(vals, dim.options) : defaultChipLabel(dim.label, vals, dim.options);
  };

  const removeDim = (dim: FilterDimension<F>) => onChange(dim.set(filters, dim.defaultValues?.(filters) ?? []));

  const resetAll = () => {
    let next = filters;
    for (const dim of activeDims) next = dim.set(next, dim.defaultValues?.(next) ?? []);
    onChange(next);
    setOpen(false);
  };

  // Apply a value pick. Single: re-picking the sole selection clears it,
  // otherwise replace + close. Multi: toggle, keep the popover open.
  const pickValue = (dim: FilterDimension<F>, value: string) => {
    const cur = dim.get(filters);
    if (dim.cardinality === "single") {
      const isSel = cur.length === 1 && cur[0] === value;
      onChange(dim.set(filters, isSel ? (dim.defaultValues?.(filters) ?? []) : [value]));
      setOpen(false);
    } else {
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      onChange(dim.set(filters, next));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={openMenu}
          className={`${CTRL_GHOST} ${open ? CTRL_ON : CTRL_OFF} h-8 gap-1.5 px-2.5 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500`}
          aria-expanded={open}
          aria-label="Add filter"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Filter</span>
        </button>

        {open && (
          <div
            className="absolute top-full left-0 mt-2 z-50 min-w-[240px] max-h-[420px] overflow-y-auto overlay-panel"
            role="menu"
          >
            {view.mode === "menu" || !editing ? (
              <DimensionMenu dims={menuDims} filters={filters} chipText={chipText} onPick={openValues} />
            ) : (
              <ValuePicker
                dim={editing}
                selected={new Set(editing.get(filters))}
                onBack={() => setView({ mode: "menu" })}
                onPick={(v) => pickValue(editing, v)}
                onClear={() => {
                  removeDim(editing);
                  setOpen(false);
                }}
              />
            )}
          </div>
        )}
      </div>

      {activeDims.map((dim) => (
        <span
          key={dim.id}
          className="inline-flex items-center rounded-full bg-rb-100 dark:bg-rb-800 text-xs text-foreground"
        >
          <button
            type="button"
            onClick={() => openValues(dim.id)}
            className="pl-2.5 pr-1.5 py-1 rounded-l-full hover:bg-rb-200/60 dark:hover:bg-rb-700/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Edit filter"
          >
            {chipText(dim)}
          </button>
          <button
            type="button"
            onClick={() => removeDim(dim)}
            className="pr-1.5 pl-0.5 py-1 rounded-r-full text-rb-500 hover:text-foreground hover:bg-rb-200/60 dark:hover:bg-rb-700/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Remove ${dim.label} filter`}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}

      {activeDims.length > 0 && (
        <button type="button" onClick={resetAll} className={`${RESET_LINK} ml-0.5`}>
          Reset
        </button>
      )}
    </div>
  );
}

function DimensionMenu<F>({
  dims,
  filters,
  chipText,
  onPick,
}: {
  dims: FilterDimension<F>[];
  filters: F;
  chipText: (dim: FilterDimension<F>) => string;
  onPick: (dimId: string) => void;
}) {
  // Render in registry order, inserting a header whenever the group changes.
  let lastGroup: string | undefined;
  return (
    <div className="py-1">
      {dims.map((dim) => {
        const showHeader = dim.group && dim.group !== lastGroup;
        lastGroup = dim.group;
        const active = isDimensionActive(dim, filters);
        return (
          <div key={dim.id}>
            {showHeader && (
              <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-rb-500">
                {dim.group}
              </div>
            )}
            <button
              type="button"
              onClick={() => onPick(dim.id)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              role="menuitem"
            >
              <span className="flex-1 text-left truncate">{active ? chipText(dim) : dim.label}</span>
              {active && <Check className="w-3.5 h-3.5 text-rb-500 shrink-0" aria-hidden="true" />}
              <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-rb-500 shrink-0" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ValuePicker<F>({
  dim,
  selected,
  onBack,
  onPick,
  onClear,
}: {
  dim: FilterDimension<F>;
  selected: Set<string>;
  onBack: () => void;
  onPick: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider text-rb-500 hover:text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          {dim.label}
        </button>
        {selected.size > 0 && (
          <button type="button" onClick={onClear} className={`${RESET_LINK} mr-2`}>
            Reset
          </button>
        )}
      </div>
      <div className="my-1 mx-3 border-t border-rb-300 dark:border-rb-700" />
      {dim.options.map((opt: FilterOptionDef) => {
        const checked = selected.has(opt.value);
        const multi = dim.cardinality === "multi";
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              checked ? "bg-rb-200/40 dark:bg-rb-700/40" : ""
            }`}
            role={multi ? "menuitemcheckbox" : "menuitemradio"}
            aria-checked={checked}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 ${multi ? "rounded-full" : "rounded-full"} transition-colors shrink-0 ${
                checked ? "bg-rb-500 border-rb-500" : "border-2 border-rb-400 dark:border-rb-600"
              }`}
              aria-hidden="true"
            >
              {checked &&
                (multi ? (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white" />
                ))}
            </span>
            {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
            <span className="text-left truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
