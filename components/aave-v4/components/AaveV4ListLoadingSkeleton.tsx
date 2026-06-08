// Mirrors the structure of AaveV4ListPageContent: a filter row of pill
// placeholders on top, then a stack of card placeholders with decaying
// opacity. No page-title heading — the filled page doesn't render one
// either, so the skeleton shouldn't conjure phantom chrome.

export function AaveV4ListLoadingSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8">
        {/* Filter row — mirrors AaveV4ListFilters: search input + filter
            button + hubs/spokes/supplying/borrowing pills + sort on right. */}
        <div className="mb-6 animate-pulse">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-10 w-full max-w-xs rounded-lg bg-skeleton" />
            <div className="h-10 w-24 rounded-lg bg-skeleton" />
            <div className="h-10 w-28 rounded-lg bg-skeleton" />
            <div className="h-10 w-28 rounded-lg bg-skeleton" />
            <div className="h-10 w-32 rounded-lg bg-skeleton" />
            <div className="h-10 w-32 rounded-lg bg-skeleton" />
            <div className="ml-auto h-10 w-32 rounded-lg bg-skeleton" />
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
