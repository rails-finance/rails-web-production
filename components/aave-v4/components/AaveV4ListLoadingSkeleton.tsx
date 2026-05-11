export function AaveV4ListLoadingSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Explore Aave V4</h1>
        <div className="animate-pulse flex space-x-3">
          <div className="h-10 bg-rb-200 dark:bg-rb-800 rounded w-1/3 mb-3"></div>
          <div className="h-10 bg-rb-200 dark:bg-rb-800 rounded w-1/3 mb-3"></div>
          <div className="h-10 bg-rb-200 dark:bg-rb-800 rounded w-1/3 mb-3"></div>
        </div>
        <div className="animate-pulse flex sm:hidden space-x-3">
          <div className="h-10 bg-rb-200 dark:bg-rb-800 rounded w-full mb-3"></div>
        </div>
        <div className="animate-pulse flex space-x-3">
          <div className="h-40 bg-rb-200 dark:bg-rb-800 rounded-lg w-full mt-3 mb-6"></div>
        </div>
        <div className="animate-pulse flex space-x-3">
          <div className="h-40 bg-rb-200/75 dark:bg-rb-800/75 rounded-lg w-full mb-6"></div>
        </div>
        <div className="animate-pulse flex space-x-3">
          <div className="h-40 bg-rb-200/50 dark:bg-rb-800/50 rounded-lg w-full mb-6"></div>
        </div>
        <div className="animate-pulse flex space-x-3">
          <div className="h-40 bg-rb-200/25 dark:bg-rb-800/25 rounded-lg w-full mb-6"></div>
        </div>
      </div>
    </main>
  );
}
