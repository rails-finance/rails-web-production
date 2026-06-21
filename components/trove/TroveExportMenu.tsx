"use client";

// Export control for the Liquity V2 trove detail page. A single button + chevron
// (open/closed indicator, matching the listing page's sort control) opens a
// dropdown of export actions, modelled on the affordance Aave use on their docs:
//
//   • Copy Page        → Markdown to clipboard, ready to paste into an LLM
//   • View as Markdown → opens the snapshot as plain text in a new tab
//   • Download CSV     → the activity timeline as a spreadsheet
//
// Pure client-side — the data is already in scope on the page; nothing is
// fetched. Markdown serialization lives in lib/liquity/trove-to-markdown.ts.

import { useState, useRef, useEffect } from "react";
import { Copy, Check, FileText, Download, ChevronDown } from "lucide-react";
import { troveToMarkdown, type TroveMarkdownArgs } from "@/lib/liquity/trove-to-markdown";
import { eventsToCsv } from "@/lib/shared/events-to-csv";
import { CTRL_GHOST, CTRL_ON, CTRL_OFF } from "@/lib/shared/ui-grammar";

type Props = Omit<TroveMarkdownArgs, "generatedAt"> & {
  /** Output file name for the CSV download, including the `.csv` extension. */
  csvFilename: string;
};

function MenuItem({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-rb-200/60 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rb-900/60"
    >
      <span className="mt-0.5 shrink-0 text-rb-500">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-rb-500">{subtitle}</span>
      </span>
    </button>
  );
}

export function TroveExportMenu({ csvFilename, ...markdownArgs }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — mirrors the listing sort dropdown.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const buildMarkdown = () => troveToMarkdown({ ...markdownArgs, generatedAt: new Date() });

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown());
      // The menu closes on action, so surface the confirmation on the trigger.
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy trove markdown:", err);
    }
    setOpen(false);
  };

  const viewMarkdown = () => {
    const blob = new Blob([buildMarkdown()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoke once the new tab has had time to load the blob.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setOpen(false);
  };

  const downloadCsv = () => {
    // Lead with a UTF-8 BOM so Excel reads non-ASCII token symbols correctly.
    const csv = "\uFEFF" + eventsToCsv(markdownArgs.events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const hasEvents = markdownArgs.events.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Export this position"
        className={`${CTRL_GHOST} ${open ? CTRL_ON : CTRL_OFF} h-8 gap-2 rounded-md px-3 text-xs font-medium`}
      >
        <span>{copied ? "Copied" : "Copy for LLM"}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 text-rb-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          className="overlay-panel absolute right-0 top-full z-50 mt-2 min-w-[260px] overflow-hidden py-1"
          role="menu"
        >
          <MenuItem
            icon={<Copy size={16} />}
            title="Copy Position"
            subtitle="Copy as Markdown for LLMs"
            onClick={copyMarkdown}
          />
          <MenuItem
            icon={<FileText size={16} />}
            title="View as Markdown"
            subtitle="View this position as plain text"
            onClick={viewMarkdown}
          />
          <MenuItem
            icon={<Download size={16} />}
            title="Download CSV"
            subtitle="Activity timeline as a spreadsheet"
            onClick={downloadCsv}
            disabled={!hasEvents}
          />
        </div>
      )}
    </div>
  );
}
