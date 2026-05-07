"use client";

/**
 * Stateless (i) toggle used next to dense UI (price axes, simulator sections).
 * Matches the event-card pattern: (i) icon with a small chevron that fades in
 * only while the expansion is open, so the button itself never moves — the
 * caller renders the actual expansion as a sibling beneath the row.
 *
 * When `warning` is true the (i) swaps to a red warning triangle so
 * dangerous states surface without requiring a click.
 */
export function InfoIconButton({
  open,
  onClick,
  warning = false,
}: {
  open: boolean;
  onClick: () => void;
  warning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={open}
      aria-label={warning ? "Warning" : open ? "Hide details" : "Show details"}
      className={`inline-flex flex-col items-center rounded transition-colors ${
        warning
          ? "text-red-400 hover:text-red-300"
          : "text-rb-500 hover:text-rb-400"
      }`}
    >
      {warning ? (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <svg
        className={`w-2.5 h-2.5 -mt-0.5 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}
