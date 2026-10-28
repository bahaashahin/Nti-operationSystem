import React from "react";
import { BarChart3 } from "lucide-react";

/**
 * Reusable ChartCard container with responsive wrapping and built-in empty state handling.
 */
export default function ChartCard({
  title,
  subtitle,
  action,
  children,
  empty = false,
  emptyMessage = "No data available for the selected filters.",
  className = "",
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs ${className}`}
    >
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-none">{action}</div>}
        </div>

        {empty ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <BarChart3 size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs sm:text-sm font-semibold">{emptyMessage}</p>
          </div>
        ) : (
          <div className="w-full min-w-0">{children}</div>
        )}
      </div>
    </div>
  );
}
