import React from "react";

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded-md bg-slate-200" />
        <div className="h-9 w-9 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-4 h-7 w-14 rounded-md bg-slate-200" />
      <div className="mt-2 h-3 w-28 rounded-md bg-slate-100" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 w-full max-w-[120px] rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton({ height = "h-64" }) {
  return (
    <div className={`w-full ${height} rounded-2xl bg-slate-100/60 animate-pulse flex items-center justify-center`}>
      <div className="h-4 w-32 rounded bg-slate-200" />
    </div>
  );
}

export default function LoadingSkeleton({ type = "dashboard" }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-3xl bg-slate-200/80" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl bg-slate-200/70" />
        <div className="h-80 rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}
