// Mirrors the structure of TrovesPageContent: filter row on top, then a
// stack of card placeholders with decaying opacity. No page-title heading —
// the filled page doesn't render one either, so the skeleton shouldn't
// conjure phantom chrome.
//
// Filter row layout mirrors TroveListFilters at the lg breakpoint:
//   left group (flex-1): [Filter btn] [Collateral pill] [Search (flex-1)]
//   right group:         [Sort dir (square)] [Sort dropdown]

export function TroveListLoadingSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 xl:gap-4 animate-pulse">
          {/* Left group — filter button, collateral pill, search */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:flex-1">
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="h-10 w-20 rounded-lg bg-rb-200 dark:bg-rb-800" />
              <div className="h-10 w-36 rounded-lg bg-rb-200 dark:bg-rb-800" />
            </div>
            <div className="h-10 w-full lg:flex-1 rounded-lg bg-rb-200 dark:bg-rb-800" />
          </div>
          {/* Right group — sort direction + sort dropdown */}
          <div className="flex items-center gap-1 w-full lg:w-auto">
            <div className="h-10 w-10 rounded-lg bg-rb-200 dark:bg-rb-800" />
            <div className="h-10 w-full lg:w-40 rounded-lg bg-rb-200 dark:bg-rb-800" />
          </div>
        </div>
        {/* Card stack — same 24px gap and lg radius as the live grid. */}
        <div className="space-y-6">
          <div className="animate-pulse h-40 bg-rb-200 dark:bg-rb-800 rounded-lg" />
          <div className="animate-pulse h-40 bg-rb-200/75 dark:bg-rb-800/75 rounded-lg" />
          <div className="animate-pulse h-40 bg-rb-200/50 dark:bg-rb-800/50 rounded-lg" />
          <div className="animate-pulse h-40 bg-rb-200/25 dark:bg-rb-800/25 rounded-lg" />
        </div>
      </div>
    </main>
  );
}
