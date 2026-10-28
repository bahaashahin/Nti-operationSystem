import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  FolderKanban,
  GraduationCap,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
  Video,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

const STATUS_CONFIG = {
  Completed: {
    label: "Completed",
    color: "#16A34A",
    badge: "bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]",
  },
  Scheduled: {
    label: "Scheduled",
    color: "#2563EB",
    badge: "bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE]",
  },
  "In progress": {
    label: "In Progress",
    color: "#D97706",
    badge: "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]",
  },
  Cancelled: {
    label: "Cancelled",
    color: "#DC2626",
    badge: "bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]",
  },
};

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

export default function LeadDashboard({
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
  const [selectedGroupCode, setSelectedGroupCode] = useState("all");
  const [timeframe, setTimeframe] = useState("all"); // 'all' | 'upcoming' | 'this_month'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("groups"); // 'groups' | 'students' | 'completed' | 'rate'
  const [sortDirection, setSortDirection] = useState("desc");

  const today = cairoToday();
  const leadName =
    profile?.name || profile?.displayName || user?.displayName || "Operations Lead";

  // Available filters options
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
      if (selectedGroupCode !== "all" && g.groupCode !== selectedGroupCode)
        return false;
      if (term) {
        const text = [
          g.groupCode,
          g.trackName,
          g.batchCode,
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
  }, [groups, selectedTrack, selectedCoordinator, selectedGroupCode, searchQuery]);

  const filteredGroupCodes = useMemo(
    () => new Set(filteredGroups.map((g) => g.groupCode)),
    [filteredGroups],
  );

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const currentMonthPrefix = today.slice(0, 7);
    return sessions.filter((s) => {
      if (!filteredGroupCodes.has(s.groupCode)) return false;
      const sDate = sessionEffectiveDate(s);
      if (timeframe === "upcoming") {
        if (s.status === "Completed") return false;
        if (sDate && sDate < today) return false;
      } else if (timeframe === "this_month") {
        if (sDate && !sDate.startsWith(currentMonthPrefix)) return false;
      }
      return true;
    });
  }, [sessions, filteredGroupCodes, timeframe, today]);

  // Unique Students count (deduplicated across filtered groups)
  const totalUniqueStudents = useMemo(() => {
    const seen = new Set();
    for (const st of students) {
      if (filteredGroupCodes.has(st.groupCode)) {
        const key = `${st.groupCode}:${st.userId || st.mobile || st.name}`;
        seen.add(key);
      }
    }
    return seen.size;
  }, [students, filteredGroupCodes]);

  // Active Coordinators count (those currently assigned to filtered groups)
  const activeCoordinatorsCount = useMemo(() => {
    return new Set(
      filteredGroups.map((g) => g.coordinatorEmail || g.coordinatorName).filter(Boolean),
    ).size;
  }, [filteredGroups]);

  // Sessions Metrics
  const completedSessionsCount = useMemo(
    () => filteredSessions.filter((s) => s.status === "Completed").length,
    [filteredSessions],
  );

  const upcomingSessionsCount = useMemo(
    () =>
      filteredSessions.filter(
        (s) =>
          s.status !== "Completed" &&
          s.status !== "Cancelled" &&
          (!sessionEffectiveDate(s) || sessionEffectiveDate(s) >= today),
      ).length,
    [filteredSessions, today],
  );

  const overallCompletionRate = useMemo(() => {
    if (!filteredSessions.length) return 0;
    return Math.round((completedSessionsCount / filteredSessions.length) * 100);
  }, [completedSessionsCount, filteredSessions.length]);

  // Section C: Session Status Distribution Donut Chart
  const sessionChartData = useMemo(() => {
    const counts = { Completed: 0, Scheduled: 0, "In progress": 0, Cancelled: 0 };
    for (const s of filteredSessions) {
      if (s.status === "Completed") counts.Completed++;
      else if (s.status === "In progress") counts["In progress"]++;
      else if (s.status === "Cancelled") counts.Cancelled++;
      else counts.Scheduled++;
    }

    return [
      { name: "Completed", value: counts.Completed, color: STATUS_CONFIG.Completed.color },
      { name: "Scheduled", value: counts.Scheduled, color: STATUS_CONFIG.Scheduled.color },
      { name: "In Progress", value: counts["In progress"], color: STATUS_CONFIG["In progress"].color },
      { name: "Cancelled", value: counts.Cancelled, color: STATUS_CONFIG.Cancelled.color },
    ].filter((item) => item.value > 0);
  }, [filteredSessions]);

  // Section D: Coordinator Workload Table Data
  const coordinatorWorkloadData = useMemo(() => {
    const map = new Map();

    for (const g of filteredGroups) {
      const coordName = g.coordinatorName || "Unassigned";
      const existing = map.get(coordName) || {
        coordinatorName: coordName,
        coordinatorEmail: g.coordinatorEmail || "",
        groupCount: 0,
        groupCodes: [],
      };
      existing.groupCount++;
      existing.groupCodes.push(g.groupCode);
      map.set(coordName, existing);
    }

    const rows = Array.from(map.values()).map((coord) => {
      // Deduplicate students for this coordinator
      const coordGroupCodes = new Set(coord.groupCodes);
      const seenStudents = new Set();
      for (const st of students) {
        if (coordGroupCodes.has(st.groupCode)) {
          seenStudents.add(`${st.groupCode}:${st.userId || st.mobile || st.name}`);
        }
      }

      // Sessions for this coordinator
      const coordSessions = sessions.filter((s) => coordGroupCodes.has(s.groupCode));
      const completed = coordSessions.filter((s) => s.status === "Completed").length;
      const pending = coordSessions.filter(
        (s) => s.status !== "Completed" && s.status !== "Cancelled",
      ).length;
      const rate = coordSessions.length
        ? Math.round((completed / coordSessions.length) * 100)
        : 0;

      // Workload category based on group count
      let workload = "Balanced";
      let workloadBadge = "bg-blue-50 text-blue-700 border-blue-200";
      if (coord.groupCount >= 6) {
        workload = "Heavy Load";
        workloadBadge = "bg-amber-50 text-amber-700 border-amber-200";
      } else if (coord.groupCount <= 2) {
        workload = "Light Load";
        workloadBadge = "bg-slate-50 text-slate-600 border-slate-200";
      }

      return {
        ...coord,
        totalStudents: seenStudents.size,
        totalSessions: coordSessions.length,
        completedSessions: completed,
        pendingSessions: pending,
        completionRate: rate,
        workload,
        workloadBadge,
      };
    });

    // Sort rows
    rows.sort((a, b) => {
      let valA = a.groupCount;
      let valB = b.groupCount;
      if (sortField === "students") {
        valA = a.totalStudents;
        valB = b.totalStudents;
      } else if (sortField === "completed") {
        valA = a.completedSessions;
        valB = b.completedSessions;
      } else if (sortField === "rate") {
        valA = a.completionRate;
        valB = b.completionRate;
      }
      return sortDirection === "desc" ? valB - valA : valA - valB;
    });

    return rows;
  }, [filteredGroups, students, sessions, sortField, sortDirection]);

  // Section E: Groups by Track Bar Chart
  const trackChartData = useMemo(() => {
    const trackCounts = {};
    for (const g of filteredGroups) {
      const track = g.trackName || "Unspecified";
      trackCounts[track] = (trackCounts[track] || 0) + 1;
    }

    return Object.entries(trackCounts)
      .map(([track, count]) => ({
        track: track.length > 18 ? `${track.slice(0, 16)}…` : track,
        fullTrack: track,
        groups: count,
      }))
      .sort((a, b) => b.groups - a.groups);
  }, [filteredGroups]);

  // Section F: Groups Requiring Attention
  const attentionItems = useMemo(() => {
    const items = [];

    // 1. Overdue sessions
    for (const s of filteredSessions) {
      const sDate = sessionEffectiveDate(s);
      if (
        sDate &&
        sDate < today &&
        s.status !== "Completed" &&
        s.status !== "Cancelled"
      ) {
        items.push({
          id: `overdue:${s.id}`,
          type: "overdue",
          severity: "high",
          title: `Session ${s.sessionNumber} attendance pending`,
          groupCode: s.groupCode,
          description: `Scheduled on ${dateLabel(sDate)} for ${s.groupCode}. Status is "${s.status || "Scheduled"}".`,
          actionLabel: "Update Session",
          actionType: "session",
          group: groups.find((g) => g.groupCode === s.groupCode),
        });
      }
    }

    // 2. Upcoming sessions in next 48h missing Zoom link
    for (const s of filteredSessions) {
      const sDate = sessionEffectiveDate(s);
      if (
        sDate &&
        sDate >= today &&
        s.status !== "Completed" &&
        s.status !== "Cancelled" &&
        !s.zoomLink
      ) {
        const diffDays =
          (new Date(sDate).getTime() - new Date(today).getTime()) /
          (1000 * 3600 * 24);
        if (diffDays >= 0 && diffDays <= 2) {
          items.push({
            id: `zoom:${s.id}`,
            type: "zoom",
            severity: "medium",
            title: `Missing Zoom link for Session ${s.sessionNumber}`,
            groupCode: s.groupCode,
            description: `Starts on ${dateLabel(sDate)} at ${sessionEffectiveTime(s) || "TBD"}.`,
            actionLabel: "Add Zoom Link",
            actionType: "session",
          });
        }
      }
    }

    // 3. Unassigned groups
    for (const g of filteredGroups) {
      if (!g.coordinatorName || !g.coordinatorEmail) {
        items.push({
          id: `unassigned:${g.groupCode}`,
          type: "unassigned",
          severity: "high",
          title: `Group ${g.groupCode} has no coordinator`,
          groupCode: g.groupCode,
          description: `Track: ${g.trackName || "Unspecified"}. Group requires assignment.`,
          actionLabel: "View Group",
          actionType: "group",
        });
      }
    }

    // 4. Low engagement groups (< 40% joined WhatsApp)
    for (const g of filteredGroups) {
      const gStudents = studentsByGroup.get(g.groupCode) || [];
      if (gStudents.length >= 3) {
        const joined = gStudents.filter((st) => st.status === "دخل الجروب").length;
        const ratio = joined / gStudents.length;
        if (ratio < 0.4) {
          items.push({
            id: `low_engagement:${g.groupCode}`,
            type: "engagement",
            severity: "low",
            title: `Low WhatsApp adoption in ${g.groupCode}`,
            groupCode: g.groupCode,
            description: `Only ${joined} of ${gStudents.length} students joined (${Math.round(ratio * 100)}%).`,
            actionLabel: "Review Roster",
            actionType: "group",
          });
        }
      }
    }

    return items;
  }, [filteredSessions, filteredGroups, groups, studentsByGroup, today]);

  // Section G: Recent Assignment Activity
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
            ? `Group ${n.groupCode} transferred to ${n.coordinatorName || n.recipientEmail || "coordinator"}`
            : `Group ${n.groupCode} assigned to ${n.coordinatorName || n.recipientEmail || "coordinator"}`,
        };
      })
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))
      .slice(0, 8);
  }, [notifications, groups]);

  const hasActiveFilters =
    selectedTrack !== "all" ||
    selectedCoordinator !== "all" ||
    selectedGroupCode !== "all" ||
    timeframe !== "all" ||
    searchQuery.trim() !== "";

  function handleResetFilters() {
    setSelectedTrack("all");
    setSelectedCoordinator("all");
    setSelectedGroupCode("all");
    setTimeframe("all");
    setSearchQuery("");
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          SECTION A: Executive Header
          ==================================================================== */}
      <DashboardHeader
        role="lead"
        userName={leadName}
        title="Operations Overview"
        subtitle="Monitor team performance, group progress, and operational activity."
        today={today}
        unreadCount={unreadCount}
        onOpenNotifications={onOpenNotifications}
      />

      {/* ====================================================================
          SECTION H: Interactive Filter Bar
          ==================================================================== */}
      <FilterBar
        title="Executive Filters"
        hasActiveFilters={hasActiveFilters}
        onReset={handleResetFilters}
      >
        {/* Track Filter */}
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

        {/* Coordinator Filter */}
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

        {/* Group Filter */}
        <label className="block text-xs font-semibold text-slate-600">
          Group
          <select
            value={selectedGroupCode}
            onChange={(e) => setSelectedGroupCode(e.target.value)}
            className="mt-1 block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
          >
            <option value="all">All Groups ({groups.length})</option>
            {groups.map((g) => (
              <option key={g.groupCode} value={g.groupCode}>
                {g.groupCode} {g.trackName ? `(${g.trackName})` : ""}
              </option>
            ))}
          </select>
        </label>

        {/* Timeframe Filter */}
        <label className="block text-xs font-semibold text-slate-600">
          Timeframe
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="mt-1 block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
          >
            <option value="all">All Sessions</option>
            <option value="upcoming">Upcoming & Pending</option>
            <option value="this_month">This Month</option>
          </select>
        </label>

        {/* Live Search */}
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
              placeholder="Search group, track, coordinator..."
              className="block w-full min-h-[38px] rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
            />
          </div>
        </label>
      </FilterBar>

      {/* ====================================================================
          SECTION B: 6 Executive KPI Cards
          ==================================================================== */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Active Groups"
          value={filteredGroups.length}
          icon={FolderKanban}
          iconColor="text-[#483BFF]"
          iconBg="bg-[#EEF2FF]"
          description="In operational scope"
        />

        <StatCard
          title="Total Students"
          value={totalUniqueStudents}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Unique enrolled"
        />

        <StatCard
          title="Active Coordinators"
          value={activeCoordinatorsCount}
          icon={UserCheck}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          description="Currently managing groups"
        />

        <StatCard
          title="Total Sessions"
          value={filteredSessions.length}
          icon={CalendarDays}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          description="Scheduled coaching"
        />

        <StatCard
          title="Completed Sessions"
          value={completedSessionsCount}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          description={`${overallCompletionRate}% completion rate`}
          variant="success"
        />

        <StatCard
          title="Pending / Upcoming"
          value={upcomingSessionsCount}
          icon={Clock}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="On active schedule"
        />
      </section>

      {/* ====================================================================
          SECTION F: Groups Requiring Attention (Actionable items)
          ==================================================================== */}
      {attentionItems.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-700 flex-none" />
              <h2 className="text-base font-bold text-amber-950">
                Operations Requiring Attention ({attentionItems.length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-800">
              Immediate follow-ups
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.slice(0, 6).map((item) => (
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
                          : item.severity === "medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {item.severity} priority
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
                      if (item.actionType === "session" && onNavigateToSessions) {
                        onNavigateToSessions(item.groupCode);
                      } else if (onSelectGroup) {
                        onSelectGroup(item.groupCode);
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
          SECTION C & E: Session Performance Donut + Groups by Track Bar Chart
          ==================================================================== */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Section C: Sessions Performance */}
        <ChartCard
          title="Session Performance"
          subtitle="Overall coaching progress and session distribution."
          empty={sessionChartData.length === 0}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
            <div className="relative h-56 w-56 flex-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sessionChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sessionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} sessions`, name]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center metric */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900">
                  {overallCompletionRate}%
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Completed
                </span>
              </div>
            </div>

            {/* Status Breakdown Legend */}
            <div className="w-full sm:w-auto flex-1 space-y-2">
              {Object.entries(STATUS_CONFIG).map(([statusKey, config]) => {
                const count = filteredSessions.filter(
                  (s) => (s.status || "Scheduled") === statusKey,
                ).length;
                const pct = filteredSessions.length
                  ? Math.round((count / filteredSessions.length) * 100)
                  : 0;

                return (
                  <div
                    key={statusKey}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-none"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="font-semibold text-slate-700">
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <strong className="text-slate-900">{count}</strong>
                      <span className="text-[10px] text-slate-400">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Overall completion</span>
            <span className="font-bold text-[#483BFF]">
              {completedSessionsCount} of {filteredSessions.length} sessions
            </span>
          </div>
        </ChartCard>

        {/* Section E: Groups by Track */}
        <ChartCard
          title="Groups by Track"
          subtitle="Workload volume distributed across academic tracks."
          empty={trackChartData.length === 0}
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trackChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="track"
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val) => [`${val} groups`, "Assigned"]}
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.fullTrack || label
                  }
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  }}
                />
                <Bar
                  dataKey="groups"
                  fill="#483BFF"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Active tracks</span>
            <span className="font-bold text-[#483BFF]">
              {trackChartData.length} tracks
            </span>
          </div>
        </ChartCard>
      </section>

      {/* ====================================================================
          SECTION D: Coordinator Workload Table
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
        <SectionHeader
          icon={UsersRound}
          title="Coordinator Workload"
          subtitle="Performance and student distribution across active coordinators."
          badge={
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {coordinatorWorkloadData.length} coordinators
            </span>
          }
        />

        {coordinatorWorkloadData.length === 0 ? (
          <EmptyState
            title="No coordinator assignments found"
            description="No coordinators match your active search and filter criteria."
          />
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[700px] text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Coordinator</th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-slate-800"
                    onClick={() => handleSort("groups")}
                  >
                    Groups {sortField === "groups" ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-slate-800"
                    onClick={() => handleSort("students")}
                  >
                    Students {sortField === "students" ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-slate-800"
                    onClick={() => handleSort("completed")}
                  >
                    Completed {sortField === "completed" ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th className="px-4 py-3">Pending</th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-slate-800"
                    onClick={() => handleSort("rate")}
                  >
                    Progress {sortField === "rate" ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th className="px-4 py-3">Workload Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {coordinatorWorkloadData.map((coord) => (
                  <tr
                    key={coord.coordinatorName}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <strong className="block text-slate-900 font-bold">
                        {coord.coordinatorName}
                      </strong>
                      <span className="text-xs text-slate-400 font-mono">
                        {coord.coordinatorEmail || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {coord.groupCount}
                    </td>

                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {coord.totalStudents}
                    </td>

                    <td className="px-4 py-3.5 text-emerald-700 font-semibold">
                      {coord.completedSessions}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 font-medium">
                      {coord.pendingSessions}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 w-8">
                          {coord.completionRate}%
                        </span>
                        <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#483BFF]"
                            style={{ width: `${coord.completionRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${coord.workloadBadge}`}
                      >
                        {coord.workload}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ====================================================================
          SECTION G: Recent Assignment Activity
          ==================================================================== */}
      <ActivityTimeline
        items={recentAssignments}
        onSelectGroup={onSelectGroup}
        title="Recent Assignment Activity"
        subtitle="Recent coordinator assignment and transfer events across the organization."
      />
    </div>
  );
}
