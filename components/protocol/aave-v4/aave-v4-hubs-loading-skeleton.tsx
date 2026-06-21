// Loading placeholder for /aave-v4/hubs, mirroring AaveV4HubViews: the
// three-column hub summary band on top, then the credit-lines heading, the
// filter chip row, and the cross-hub asset table. The header (breadcrumb,
// title, intro) is rendered live by the page, so the skeleton only stands in
// for the data region below it. Uses the shared bg-skeleton token and the same
// gaps / radii / column count as the filled view so nothing shifts on load.

export function AaveV4HubsLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Hub summary band — three columns, matching the lg:grid-cols-3 / gap-6 band. */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-rb-200 p-4 dark:border-rb-800">
            <div className="mb-4 h-5 w-28 rounded bg-skeleton" />
            <div className="mb-2 h-8 w-36 rounded bg-skeleton" />
            <div className="mb-6 h-3 w-20 rounded bg-skeleton" />
            <div className="mb-3 h-3 w-full rounded-full bg-skeleton" />
            <div className="space-y-2">
              <div className="h-3 w-3/4 rounded bg-skeleton" />
              <div className="h-3 w-2/3 rounded bg-skeleton" />
              <div className="h-3 w-1/2 rounded bg-skeleton" />
            </div>
          </div>
        ))}
      </div>

      {/* Credit-lines heading + intro. */}
      <div className="mb-3">
        <div className="h-3 w-24 rounded bg-skeleton" />
        <div className="mt-2 h-3 w-80 max-w-full rounded bg-skeleton" />
      </div>

      {/* Filter chip row. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-10 rounded bg-skeleton" />
          <div className="h-7 w-12 rounded-full bg-skeleton" />
          <div className="h-7 w-20 rounded-full bg-skeleton" />
          <div className="h-7 w-16 rounded-full bg-skeleton" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-8 rounded bg-skeleton" />
          <div className="h-7 w-12 rounded-full bg-skeleton" />
          <div className="h-7 w-16 rounded-full bg-skeleton" />
          <div className="h-7 w-16 rounded-full bg-skeleton" />
        </div>
      </div>

      {/* Asset table — header strip + decaying-opacity rows. */}
      <div className="overflow-hidden rounded-lg border border-rb-200 dark:border-rb-800">
        <div className="h-9 bg-foreground/[0.03]" />
        {[1, 0.75, 0.6, 0.45, 0.3, 0.2].map((opacity, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-rb-200 px-3 py-3 dark:border-rb-800"
            style={{ opacity }}
          >
            <div className="h-5 w-5 shrink-0 rounded-full bg-skeleton" />
            <div className="h-3 w-16 rounded bg-skeleton" />
            <div className="ml-auto h-3 w-12 rounded bg-skeleton" />
            <div className="h-3 w-16 rounded bg-skeleton" />
            <div className="h-3 w-16 rounded bg-skeleton" />
            <div className="h-3 w-12 rounded bg-skeleton" />
            <div className="h-3 w-12 rounded bg-skeleton" />
            <div className="h-3 w-14 rounded bg-skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
