import React from "react";
import { Filter, RotateCcw } from "lucide-react";

export default function FilterBar({
  title = "Dashboard Filters",
  hasActiveFilters = false,
  onReset,
  children,
  className = "",
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <Filter size={14} className="text-[#483BFF]" />
          <span>{title}</span>
        </div>

        {hasActiveFilters && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#483BFF] hover:bg-[#EEF2FF] transition-all"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-end">
        {children}
      </div>
    </section>
  );
}
