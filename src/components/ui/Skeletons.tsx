import React from 'react';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 animate-pulse" aria-label="Loading records">
      <div className="h-9 rounded-lg bg-slate-200/70 dark:bg-white/5" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-lg bg-slate-100 dark:bg-white/[0.03] border border-slate-200/60 dark:border-[#232838]"
        />
      ))}
    </div>
  );
}

export function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-28 rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#232838] p-5"
        >
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-7 w-32 rounded bg-slate-200 dark:bg-white/10 mt-4" />
        </div>
      ))}
    </div>
  );
}
