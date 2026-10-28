import React from "react";

/**
 * Reusable StatCard component following Coaching Ops modern SaaS aesthetic.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-[#483BFF]",
  iconBg = "bg-[#EEF2FF]",
  description,
  badge,
  variant = "default",
  onClick,
  className = "",
}) {
  const isInteractive = Boolean(onClick);

  const variantStyles = {
    default: "border-slate-200/90 bg-white hover:border-[#483BFF]/40",
    primary: "border-indigo-200/80 bg-gradient-to-br from-white to-[#EEF2FF]/30 hover:border-[#483BFF]",
    warning: "border-amber-200/90 bg-amber-50/40 hover:border-amber-300",
    danger: "border-rose-200/90 bg-rose-50/40 hover:border-rose-300",
    success: "border-emerald-200/90 bg-emerald-50/40 hover:border-emerald-300",
  }[variant] || "border-slate-200/90 bg-white";

  return (
    <div
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-150 ${variantStyles} ${
        isInteractive ? "cursor-pointer hover:shadow-md active:scale-[0.99]" : "hover:shadow-sm"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">
            {title}
          </span>
          {Icon && (
            <div
              className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-none items-center justify-center rounded-xl ${iconBg} ${iconColor} transition-transform`}
            >
              <Icon size={19} />
            </div>
          )}
        </div>

        <strong className="mt-2.5 sm:mt-3 block text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
          {value ?? "—"}
        </strong>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {description && (
          <span className="text-xs text-slate-500 truncate">
            {description}
          </span>
        )}
        {badge && <div className="flex-none">{badge}</div>}
      </div>
    </div>
  );
}
