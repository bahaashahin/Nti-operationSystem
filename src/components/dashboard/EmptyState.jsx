import React from "react";
import { FolderKanban } from "lucide-react";

export default function EmptyState({
  icon: Icon = FolderKanban,
  title = "No data found",
  description = "No items match your active filters or operational criteria.",
  actionLabel,
  onAction,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
        <Icon size={24} />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3.5 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#EEF2FF] px-3.5 py-1.5 text-xs font-bold text-[#483BFF] hover:bg-[#E0E7FF] transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
