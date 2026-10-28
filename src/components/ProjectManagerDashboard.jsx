import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  FolderKanban,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cairoToday, dateLabel } from "../importExcel";
import StatusBadge from "./StatusBadge";
import DashboardHeader from "./dashboard/DashboardHeader";
import StatCard from "./dashboard/StatCard";
import ChartCard from "./dashboard/ChartCard";
import FilterBar from "./dashboard/FilterBar";
import SectionHeader from "./dashboard/SectionHeader";
import EmptyState from "./dashboard/EmptyState";
import ActivityTimeline from "./dashboard/ActivityTimeline";

function sessionEffectiveDate(session) {
  return session.overrideDate || session.scheduledDate || "";
}

function sessionEffectiveTime(session) {
  return session.overrideTime || session.time || "";
}

function formatAssignmentTimestamp(dateVal, includeTime = true) {
  if (!dateVal) return "Assignment date unavailable";
  try {
    const d =
      dateVal?.toDate
        ? dateVal.toDate()
        : dateVal instanceof Date
        ? dateVal
        : new Date(dateVal);

    if (Number.isNaN(d.getTime())) return "Assignment date unavailable";

    const dateStr = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(d);

    if (!includeTime) return dateStr;

    const hasTime =
      d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
    if (!hasTime) return dateStr;

    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);

    return `${dateStr} at ${timeStr}`;
  } catch {
    return "Assignment date unavailable";
  }
}

export default function ProjectManagerDashboard({
  user,
  profile,
  groups = [],
  students = [],
  sessions = [],
  notifications = [],
  unreadCount = 0,
  onOpenNotifications,
  onSelectGroup,
  onNavigateToSessions,
}) {
  const [selectedTrack, setSelectedTrack] = useState("all");
  const [selectedCoordinator, setSelectedCoordinator] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all"); // 'all' | 'active' | 'completed' | 'in_progress'
  const [searchQuery, setSearchQuery] = useState("");

  const today = cairoToday();
  const pmName =
    profile?.name || profile?.displayName || user?.displayName || "Project Manager";

  // Available Filter Options
  const availableTracks = useMemo(() => {
    return [...new Set(groups.map((g) => g.trackName).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [groups]);

  const availableCoordinators = useMemo(() => {
    return [
      ...new Set(groups.map((g) => g.coordinatorName).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [groups]);

  // Students map by group
  const studentsByGroup = useMemo(() => {
    const map = new Map();
    for (const student of students) {
      const list = map.get(student.groupCode) || [];
      list.push(student);
      map.set(student.groupCode, list);
    }
    return map;
  }, [students]);

  // Sessions map by group
  const sessionsByGroup = useMemo(() => {
    const map = new Map();
    for (const sess of sessions) {
      const list = map.get(sess.groupCode) || [];
      list.push(sess);
      map.set(sess.groupCode, list);
    }
    return map;
  }, [sessions]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return groups.filter((g) => {
      if (selectedTrack !== "all" && g.trackName !== selectedTrack) return false;
      if (
        selectedCoordinator !== "all" &&
        g.coordinatorName !== selectedCoordinator
      )
        return false;

      // Status filter
      if (selectedStatus !== "all") {
        const gSessions = sessionsByGroup.get(g.groupCode) || [];
        const completed = gSessions.filter((s) => s.status === "Completed").length;
        const total = gSessions.length || 10;
        if (selectedStatus === "completed" && completed < total) return false;
        if (selectedStatus === "in_progress" && (completed === 0 || completed === total))
          return false;
        if (selectedStatus === "not_started" && completed > 0) return false;
      }

      if (term) {
        const text = [
          g.groupCode,
          g.trackName,
          g.coordinatorName,
          g.coachName,
          g.day,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }, [groups, selectedTrack, selectedCoordinator, selectedStatus, searchQuery, sessionsByGroup]);

  const filteredGroupCodes = useMemo(
    () => new Set(filteredGroups.map((g) => g.groupCode)),
    [filteredGroups],
  );

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => filteredGroupCodes.has(s.groupCode));
  }, [sessions, filteredGroupCodes]);

  // Unique Students count
  const totalUniqueStudents = useMemo(() => {
    const seen = new Set();
    for (const st of students) {
      if (filteredGroupCodes.has(st.groupCode)) {
        seen.add(`${st.groupCode}:${st.userId || st.mobile || st.name}`);
      }
    }
    return seen.size;
  }, [students, filteredGroupCodes]);

  // Coordinators count under management
  const assignedCoordinatorsCount = useMemo(() => {
    return new Set(
      filteredGroups.map((g) => g.coordinatorEmail || g.coordinatorName).filter(Boolean),
    ).size;
  }, [filteredGroups]);

  // Section C: Today's Operations
  const todayOperations = useMemo(() => {
    const todaySessions = filteredSessions.filter(
      (s) => sessionEffectiveDate(s) === today,
    );
    const completedToday = todaySessions.filter(
      (s) => s.status === "Completed",
    ).length;
    const pendingUpdates = todaySessions.filter(
      (s) => s.status !== "Completed" && s.status !== "Cancelled",
    ).length;
    const rescheduledToday = todaySessions.filter(
      (s) => s.overrideDate && s.overrideDate === today,
    ).length;

    return {
      total: todaySessions.length,
      completedToday,
      pendingUpdates,
      rescheduledToday,
      sessions: todaySessions,
    };
  }, [filteredSessions, today]);

  // Overdue sessions (past date, not Completed or Cancelled)
  const overdueSessions = useMemo(() => {
    return filteredSessions.filter((s) => {
      const sDate = sessionEffectiveDate(s);
      return (
        sDate &&
        sDate < today &&
        s.status !== "Completed" &&
        s.status !== "Cancelled"
      );
    });
  }, [filteredSessions, today]);

  // Upcoming scheduled sessions
  const upcomingSessions = useMemo(() => {
    return filteredSessions.filter((s) => {
      const sDate = sessionEffectiveDate(s);
      return (
        sDate &&
        sDate >= today &&
        s.status !== "Completed" &&
        s.status !== "Cancelled"
      );
    });
  }, [filteredSessions, today]);

  // Section G: Action Required Items
  const actionRequiredItems = useMemo(() => {
    const items = [];

    // 1. Overdue sessions
    for (const s of overdueSessions) {
      const sDate = sessionEffectiveDate(s);
      items.push({
        id: `overdue:${s.id}`,
        type: "overdue",
        severity: "high",
        title: `Overdue Session #${s.sessionNumber} (${s.groupCode})`,
        description: `Scheduled on ${dateLabel(sDate)}. Attendance not recorded.`,
        actionLabel: "Update Session",
        groupCode: s.groupCode,
      });
    }

    // 2. Missing zoom in upcoming 48 hours
    for (const s of upcomingSessions) {
      const sDate = sessionEffectiveDate(s);
      if (!s.zoomLink) {
        const diffDays =
          (new Date(sDate).getTime() - new Date(today).getTime()) /
          (1000 * 3600 * 24);
        if (diffDays >= 0 && diffDays <= 2) {
          items.push({
            id: `zoom:${s.id}`,
            type: "missing_zoom",
            severity: "medium",
            title: `Missing Zoom link for Session #${s.sessionNumber}`,
            description: `Group ${s.groupCode} scheduled on ${dateLabel(sDate)} at ${sessionEffectiveTime(s) || "TBD"}.`,
            actionLabel: "Manage Session",
            groupCode: s.groupCode,
          });
        }
      }
    }

    // 3. Unassigned coordinator
    for (const g of filteredGroups) {
      if (!g.coordinatorName || !g.coordinatorEmail) {
        items.push({
          id: `unassigned:${g.groupCode}`,
          type: "unassigned",
          severity: "high",
          title: `Group ${g.groupCode} requires coordinator assignment`,
          description: `Track: ${g.trackName || "Unspecified"}.`,
          actionLabel: "View Group",
          groupCode: g.groupCode,
        });
      }
    }

    return items;
  }, [overdueSessions, upcomingSessions, filteredGroups, today]);

  // Section D: Coordinator Workload Breakdown
  const coordinatorWorkloadList = useMemo(() => {
    const map = new Map();
    for (const g of filteredGroups) {
      const coordName = g.coordinatorName || "Unassigned";
      const existing = map.get(coordName) || {
        coordinatorName: coordName,
        groupCount: 0,
        groupCodes: [],
      };
      existing.groupCount++;
      existing.groupCodes.push(g.groupCode);
      map.set(coordName, existing);
    }

    return Array.from(map.values()).map((coord) => {
      const gCodes = new Set(coord.groupCodes);
      const studentCount = students.filter((st) => gCodes.has(st.groupCode)).length;
      const cSessions = sessions.filter((s) => gCodes.has(s.groupCode));
      const upcoming = cSessions.filter(
        (s) =>
          sessionEffectiveDate(s) >= today &&
          s.status !== "Completed" &&
          s.status !== "Cancelled",
      ).length;
      const overdue = cSessions.filter(
        (s) =>
          sessionEffectiveDate(s) < today &&
          s.status !== "Completed" &&
          s.status !== "Cancelled",
      ).length;

      return {
        ...coord,
        studentCount,
        upcomingSessions: upcoming,
        pendingActions: overdue,
      };
    });
  }, [filteredGroups, students, sessions, today]);

  // Section H: Next 7 Days Upcoming Sessions
  const next7DaysSessions = useMemo(() => {
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    const maxDateStr = maxDate.toISOString().slice(0, 10);

    return filteredSessions
      .filter((s) => {
        const sDate = sessionEffectiveDate(s);
        return (
          sDate &&
          sDate >= today &&
          sDate <= maxDateStr &&
          s.status !== "Completed" &&
          s.status !== "Cancelled"
        );
      })
      .sort((a, b) => {
        const da = sessionEffectiveDate(a) || "9999-99-99";
        const db = sessionEffectiveDate(b) || "9999-99-99";
        return da.localeCompare(db);
      })
      .slice(0, 8);
  }, [filteredSessions, today]);

  // Section F: Recently Assigned Groups
  const recentAssignments = useMemo(() => {
    return notifications
      .map((n) => {
        const isSuperseded = Boolean(n.superseded);
        const isReassigned = n.type === "reassignment";
        const groupExists = groups.some((g) => g.groupCode === n.groupCode);

        return {
          id: n.id,
          groupCode: n.groupCode,
          coordinatorName: n.coordinatorName || n.recipientEmail || "",
          formattedDate: formatAssignmentTimestamp(n.createdAtDate),
          dateObj: n.createdAtDate || new Date(),
          isSuperseded,
          isReassigned,
          canNavigate: groupExists,
          title: isReassigned
            ? `Group ${n.groupCode} transferred to ${n.coordinatorName || "coordinator"}`
            : `Group ${n.groupCode} assigned to ${n.coordinatorName || "coordinator"}`,
        };
      })
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))
      .slice(0, 6);
  }, [notifications, groups]);

  const hasActiveFilters =
    selectedTrack !== "all" ||
    selectedCoordinator !== "all" ||
    selectedStatus !== "all" ||
    searchQuery.trim() !== "";

  function handleResetFilters() {
    setSelectedTrack("all");
    setSelectedCoordinator("all");
    setSelectedStatus("all");
    setSearchQuery("");
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          SECTION A: Header
          ==================================================================== */}
      <DashboardHeader
        role="project_manager"
        userName={pmName}
        title="Project Management Overview"
        subtitle="Track assignments, monitor sessions, and keep operations on schedule."
        today={today}
        unreadCount={unreadCount}
        onOpenNotifications={onOpenNotifications}
      />

      {/* ====================================================================
          INTERACTIVE FILTERS
          ==================================================================== */}
      <FilterBar
        title="Operations Filters"
        hasActiveFilters={hasActiveFilters}
        onReset={handleResetFilters}
      >
        <label className="block text-xs font-semibold text-slate-600">
          Track
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="mt-1 block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
          >
            <option value="all">All Tracks ({availableTracks.length})</option>
            {availableTracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          Coordinator
          <select
            value={selectedCoordinator}
            onChange={(e) => setSelectedCoordinator(e.target.value)}
            className="mt-1 block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
          >
            <option value="all">
              All Coordinators ({availableCoordinators.length})
            </option>
            {availableCoordinators.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          Group Status
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="mt-1 block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
          >
            <option value="all">All Group Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="not_started">Not Started</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-600 sm:col-span-2 md:col-span-1">
          Search
          <div className="relative mt-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search group, coordinator, coach..."
              className="block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
            />
          </div>
        </label>
      </FilterBar>

      {/* ====================================================================
          SECTION B: 6 KPI Cards
          ==================================================================== */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Groups Under Mgmt"
          value={filteredGroups.length}
          icon={FolderKanban}
          iconColor="text-[#483BFF]"
          iconBg="bg-[#EEF2FF]"
          description="In operational scope"
        />

        <StatCard
          title="Coordinators"
          value={assignedCoordinatorsCount}
          icon={UsersRound}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          description="Active coordinators"
        />

        <StatCard
          title="Total Students"
          value={totalUniqueStudents}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Supervised students"
        />

        <StatCard
          title="Upcoming Sessions"
          value={upcomingSessions.length}
          icon={Clock}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Next on schedule"
        />

        <StatCard
          title="Overdue Sessions"
          value={overdueSessions.length}
          icon={AlertCircle}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
          description={
            overdueSessions.length > 0 ? "Pending attendance" : "None overdue"
          }
          variant={overdueSessions.length > 0 ? "danger" : "default"}
        />

        <StatCard
          title="Needs Attention"
          value={actionRequiredItems.length}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          description={
            actionRequiredItems.length > 0
              ? "Actionable items"
              : "Operations up to date"
          }
          variant={actionRequiredItems.length > 0 ? "warning" : "default"}
        />
      </section>

      {/* ====================================================================
          SECTION C: Today's Operations
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
        <SectionHeader
          icon={Calendar}
          title="Today's Operational Summary"
          subtitle={`Coaching sessions scheduled for Cairo date: ${dateLabel(today)}`}
          badge={
            <span className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-bold text-[#483BFF]">
              {todayOperations.total} Sessions Today
            </span>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Today
            </span>
            <strong className="mt-1 block text-2xl font-extrabold text-slate-900">
              {todayOperations.total}
            </strong>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Completed Today
            </span>
            <strong className="mt-1 block text-2xl font-extrabold text-emerald-700">
              {todayOperations.completedToday}
            </strong>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Pending Updates
            </span>
            <strong className="mt-1 block text-2xl font-extrabold text-amber-700">
              {todayOperations.pendingUpdates}
            </strong>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Rescheduled To Today
            </span>
            <strong className="mt-1 block text-2xl font-extrabold text-blue-700">
              {todayOperations.rescheduledToday}
            </strong>
          </div>
        </div>

        {todayOperations.sessions.length > 0 && (
          <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
            {todayOperations.sessions.map((sess) => (
              <div
                key={sess.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-slate-900">
                    {sess.groupCode}
                  </span>
                  <span className="text-slate-500">
                    Session #{sess.sessionNumber}
                  </span>
                  {sess.overrideDate && (
                    <StatusBadge status="rescheduled" size="sm" />
                  )}
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-slate-700">
                    {sessionEffectiveTime(sess) || "Time TBD"}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  <StatusBadge status={sess.status || "scheduled"} size="sm" />
                  {onNavigateToSessions && (
                    <button
                      type="button"
                      onClick={() => onNavigateToSessions(sess.groupCode)}
                      className="text-[#483BFF] font-semibold hover:underline"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ====================================================================
          SECTION G: Action Required Alerts
          ==================================================================== */}
      {actionRequiredItems.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-700 flex-none" />
              <h2 className="text-base font-bold text-amber-950">
                Action Required ({actionRequiredItems.length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-800">
              Priority alerts
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {actionRequiredItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-amber-200/90 bg-white p-3.5 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#3729E6]">
                      {item.groupCode}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.severity === "high"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === "unassigned" && onSelectGroup) {
                        onSelectGroup(item.groupCode);
                      } else if (onNavigateToSessions) {
                        onNavigateToSessions(item.groupCode);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#483BFF] hover:text-[#3729E6] transition-colors"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====================================================================
          SECTION E: Group Progress Tracker Table
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
        <SectionHeader
          icon={FolderKanban}
          title="Group Progress Tracker"
          subtitle="Real-time session completion and schedules across all managed groups."
          badge={
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {filteredGroups.length} groups
            </span>
          }
        />

        {filteredGroups.length === 0 ? (
          <EmptyState
            title="No groups found"
            description="No groups match your current filter and search criteria."
          />
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[760px] text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Group Code</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">Coordinator</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Sessions Progress</th>
                  <th className="px-4 py-3">Next Session</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((g) => {
                  const gStudents = studentsByGroup.get(g.groupCode) || [];
                  const gSessions = sessionsByGroup.get(g.groupCode) || [];
                  const completed = gSessions.filter(
                    (s) => s.status === "Completed",
                  ).length;
                  const total = gSessions.length || 10;
                  const progressPct = Math.round((completed / total) * 100);

                  const nextSession = gSessions
                    .filter(
                      (s) =>
                        s.status !== "Completed" && s.status !== "Cancelled",
                    )
                    .sort((a, b) => {
                      const da = sessionEffectiveDate(a) || "9999-99-99";
                      const db = sessionEffectiveDate(b) || "9999-99-99";
                      return da.localeCompare(db);
                    })[0];

                  const groupStatus =
                    progressPct === 100
                      ? "Completed"
                      : completed > 0
                      ? "In progress"
                      : "Active";

                  return (
                    <tr
                      key={g.groupCode}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-extrabold text-[#483BFF]">
                          {g.groupCode}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {g.trackName || "Unspecified"}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="block font-semibold text-slate-800">
                          {g.coordinatorName || "Unassigned"}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {g.coordinatorEmail || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {gStudents.length}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 w-14">
                            {completed}/{total}
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#483BFF]"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {progressPct}%
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {nextSession ? (
                          <>
                            <strong className="block text-slate-800">
                              {dateLabel(sessionEffectiveDate(nextSession))}
                            </strong>
                            <span className="text-slate-400">
                              #{nextSession.sessionNumber} ·{" "}
                              {sessionEffectiveTime(nextSession) || "TBD"}
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-600 font-medium">
                            Completed
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge status={groupStatus} size="sm" />
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {onSelectGroup && (
                          <button
                            type="button"
                            onClick={() => onSelectGroup(g.groupCode)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#483BFF] hover:underline"
                          >
                            <span>View</span>
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ====================================================================
          SECTION D & H: Coordinator Workload Grid + Next 7 Days Sessions
          ==================================================================== */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Section D: Coordinator Workload Grid */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
          <SectionHeader
            icon={UsersRound}
            title="Coordinator Workload"
            subtitle="Student count and pending items per assigned coordinator."
          />

          <div className="space-y-3">
            {coordinatorWorkloadList.map((coord) => (
              <div
                key={coord.coordinatorName}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70 text-xs"
              >
                <div>
                  <strong className="block font-bold text-slate-900">
                    {coord.coordinatorName}
                  </strong>
                  <span className="text-slate-500">
                    {coord.groupCount} groups · {coord.studentCount} students
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block font-bold text-slate-800">
                      {coord.upcomingSessions} upcoming
                    </span>
                    <span className="text-[11px] text-amber-700">
                      {coord.pendingActions} overdue
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section H: Upcoming Sessions (Next 7 Days) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
          <SectionHeader
            icon={Clock}
            title="Next 7 Days Sessions"
            subtitle="Immediate weekly coaching sessions schedule."
          />

          {next7DaysSessions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <CalendarDays size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">
                No sessions scheduled in the next 7 days.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {next7DaysSessions.map((sess) => {
                const sDate = sessionEffectiveDate(sess);
                const sTime = sessionEffectiveTime(sess);

                return (
                  <div
                    key={sess.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#483BFF]">
                          {sess.groupCode}
                        </span>
                        <span className="text-slate-800 font-semibold">
                          Session #{sess.sessionNumber}
                        </span>
                        {sess.overrideDate && (
                          <StatusBadge status="rescheduled" size="sm" />
                        )}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {dateLabel(sDate)} {sTime && `· ${sTime}`}
                        {sess.coachName && ` · Coach: ${sess.coachName}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      <StatusBadge status={sess.status || "scheduled"} size="sm" />
                      {onNavigateToSessions && (
                        <button
                          type="button"
                          onClick={() => onNavigateToSessions(sess.groupCode)}
                          className="text-[#483BFF] font-semibold hover:underline"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          SECTION F: Recently Assigned Groups Activity Timeline
          ==================================================================== */}
      <ActivityTimeline
        items={recentAssignments}
        onSelectGroup={onSelectGroup}
        title="Recently Assigned Groups"
        subtitle="Operational audit log of recent group assignments and coordinator transfers."
      />
    </div>
  );
}
