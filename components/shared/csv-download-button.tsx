"use client";

// Download-the-activity-as-CSV button. Drops into a detail page's Activity
// header next to the sort / filter / display controls. Pure client-side: it
// serializes the in-memory event array (eventsToCsv) and triggers a Blob
// download — no API round-trip, no server work.

import { Download } from "lucide-react";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { eventsToCsv } from "@/lib/shared/events-to-csv";

// Master switch for the activity-timeline CSV export. Hidden for now while the
// feature is held back; flip to `true` to reinstate the download button on the
// Aave V4 spoke + Liquity trove detail pages. The serializer
// (lib/shared/events-to-csv.ts) and this component stay in place so bringing it
// back is a one-line change.
export const ENABLE_CSV_EXPORT = false;

export function CsvDownloadButton({
  events,
  filename,
}: {
  events: BaseActivityEvent[];
  /** Output file name, including the `.csv` extension. */
  filename: string;
}) {
  const disabled = events.length === 0;

  const handleDownload = () => {
    if (disabled) return;
    // Lead with a UTF-8 BOM ("\uFEFF") so Excel reads non-ASCII token symbols correctly.
    const csv = "\uFEFF" + eventsToCsv(events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled}
      aria-label="Download activity as CSV"
      title={disabled ? "No events to export" : "Download activity as CSV"}
      className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-rb-300/60 dark:border-rb-700/60 text-rb-500 hover:text-foreground hover:bg-rb-200/60 dark:hover:bg-rb-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download size={14} />
      CSV
    </button>
  );
}
