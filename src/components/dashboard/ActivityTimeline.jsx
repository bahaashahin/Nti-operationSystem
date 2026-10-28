import React from "react";
import { ChevronRight, Clock } from "lucide-react";
import StatusBadge from "../StatusBadge";

export default function ActivityTimeline({
  items = [],
  onSelectGroup,
  title = "Recent Assignment Activity",
  subtitle = "Audit trail of group assignment and coordinator transfer events.",
  emptyMessage = "No assignment activity recorded.",
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-3 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-400">
          Real assignment events
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Clock size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs sm:text-sm font-semibold">{emptyMessage}</p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex items-start justify-between gap-3"
            >
              {/* Node dot */}
              <span
                className={`absolute -left-6 sm:-left-8 top-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full ring-4 ring-white ${
                  item.isSuperseded
                    ? "bg-slate-300"
                    : item.isReassigned
                    ? "bg-amber-500"
                    : "bg-[#483BFF]"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {item.groupCode}
                  </span>

                  {item.coordinatorName && (
                    <span className="text-xs text-slate-600 font-medium">
                      → {item.coordinatorName}
                    </span>
                  )}

                  {item.isSuperseded ? (
                    <StatusBadge
                      status="superseded"
                      label="Superseded"
                      size="sm"
                    />
                  ) : item.isReassigned ? (
                    <StatusBadge
                      status="reassigned"
                      label="Reassigned"
                      size="sm"
                    />
                  ) : (
                    <StatusBadge
                      status="new assignment"
                      label="New Assignment"
                      size="sm"
                    />
                  )}

                  {item.formattedDate && (
                    <span className="text-[11px] text-slate-400">
                      {item.formattedDate}
                    </span>
                  )}
                </div>

                <p
                  className={`mt-0.5 text-xs ${
                    item.isSuperseded
                      ? "text-slate-400 line-through"
                      : "text-slate-700"
                  }`}
                >
                  {item.title || item.message}
                </p>
              </div>

              {item.canNavigate && onSelectGroup && (
                <button
                  type="button"
                  onClick={() => onSelectGroup(item.groupCode)}
                  className="flex-none inline-flex items-center gap-1 text-xs font-semibold text-[#483BFF] hover:underline"
                >
                  <span>View Group</span>
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
