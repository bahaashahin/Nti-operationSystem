import React from "react";

export default function SectionHeader({
  icon: Icon,
  iconColor = "text-[#483BFF]",
  title,
  subtitle,
  badge,
  action,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-4 border-b border-slate-100 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] flex-none">
            <Icon size={17} className={iconColor} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              {title}
            </h2>
            {badge && <div className="flex-none">{badge}</div>}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}
