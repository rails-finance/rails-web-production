// Mirrors the structure of TrovesPageContent: the resting filter row on top,
// then a stack of card placeholders with decaying opacity. No page-title
// heading — the filled page doesn't render one either, so the skeleton
// shouldn't conjure phantom chrome. No chip row, since chips only appear once a
// predicate is set (the resting wallet-view state is quiet).
//
// Filter row mirrors TroveListFilters at rest: the Status / Collateral /
// Redemptions / Delegation section dropdowns, then the address search (flex-1),
// then the sort order toggle + sort menu. Heights match the live h-8 controls.

export function TroveListLoadingSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-6 animate-pulse flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-8 w-16 rounded-md bg-skeleton" />
            <div className="h-8 w-24 rounded-md bg-skeleton" />
            <div className="h-8 w-28 rounded-md bg-skeleton" />
            <div className="h-8 w-24 rounded-md bg-skeleton" />
          </div>
          <div className="h-8 w-full lg:flex-1 rounded-md bg-skeleton" />
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 rounded-md bg-skeleton" />
            <div className="h-8 w-40 rounded-md bg-skeleton" />
          </div>
        </div>
        {/* Card stack — same 24px gap and lg radius as the live grid. */}
        <div className="space-y-6">
          <div className="animate-pulse h-40 bg-skeleton rounded-lg" />
          <div className="animate-pulse h-40 bg-rb-200/75 dark:bg-rb-800/75 rounded-lg" />
          <div className="animate-pulse h-40 bg-rb-200/50 dark:bg-rb-800/50 rounded-lg" />
          <div className="animate-pulse h-40 bg-rb-200/25 dark:bg-rb-800/25 rounded-lg" />
        </div>
      </div>
    </main>
  );
}
