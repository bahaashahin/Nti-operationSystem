import React, { useMemo } from "react";
import { Bell, Calendar, Sparkles } from "lucide-react";
import { dateLabel } from "../../importExcel";

/**
 * Shared DashboardHeader component.
 * Adapts between Executive (Lead), Operational (Project Manager), and Personalized (Coordinator) roles.
 */
export default function DashboardHeader({
  role = "coordinator",
  userName = "",
  title,
  subtitle,
  today = "",
  unreadCount = 0,
  onOpenNotifications,
  children,
}) {
  const isCoordinator = role === "coordinator";

  const greeting = useMemo(() => {
    if (!isCoordinator) return null;
    const hour = new Date().getHours();
    let timeGreeting = "Good evening";
    if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
    else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";

    const firstName = (userName || "Coordinator").trim().split(" ")[0];
    return `${timeGreeting}, ${firstName}`;
  }, [isCoordinator, userName]);

  const initials = useMemo(() => {
    const name = userName || (isCoordinator ? "Coordinator" : "Team Member");
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [userName, isCoordinator]);

  const displayTitle = title || greeting || "Dashboard Overview";
  const displaySubtitle =
    subtitle ||
    (isCoordinator
      ? "Here's a comprehensive overview of your active coaching operations."
      : role === "lead"
      ? "Monitor team performance, group progress, and operational activity."
      : "Track assignments, monitor sessions, and keep operations on schedule.");

  const roleBadgeLabel =
    role === "lead"
      ? "Executive Operations"
      : role === "project_manager"
      ? "Project Operations"
      : "Coordinator Operations";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-[#EEF2FF]/40 p-4 sm:p-6 lg:p-7 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          {/* Avatar with Initials */}
          <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 flex-none items-center justify-center rounded-2xl bg-gradient-to-tr from-[#483BFF] to-[#6366F1] text-base sm:text-xl font-extrabold text-white shadow-md shadow-[#483BFF]/20 ring-4 ring-white">
            {initials}
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
              title="Online"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#483BFF]">
                <Sparkles size={11} />
                <span>{roleBadgeLabel}</span>
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-300">·</span>
              <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date())}
              </span>
            </div>

            <h1 className="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
              {displayTitle}
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 truncate">
              {displaySubtitle}
            </p>
          </div>
        </div>

        {/* Right side controls: Notification trigger and Cairo Date */}
        <div className="flex items-center gap-2.5 flex-none self-start sm:self-center">
          {unreadCount > 0 && onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#EEF2FF] px-3.5 py-2 text-xs font-bold text-[#483BFF] hover:bg-[#E0E7FF] transition-all shadow-2xs"
            >
              <Bell size={14} className="animate-pulse" />
              <span>
                {unreadCount} New Assignment{unreadCount > 1 ? "s" : ""}
              </span>
            </button>
          )}

          {today && (
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-right shadow-2xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cairo Date
              </span>
              <span className="block font-mono text-xs font-bold text-slate-800">
                {dateLabel(today)}
              </span>
            </div>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
