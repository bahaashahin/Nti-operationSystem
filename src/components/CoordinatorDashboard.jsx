import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  FolderKanban,
  GraduationCap,
  Layers,
  MessageCircle,
  RotateCcw,
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

const STATUS_CONFIG = {
  Completed: {
    label: "Completed",
    color: "#16A34A",
    badge: "bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]",
    pill: "bg-[#16A34A]",
  },
  Scheduled: {
    label: "Scheduled",
    color: "#2563EB",
    badge: "bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE]",
    pill: "bg-[#2563EB]",
  },
  "In progress": {
    label: "In Progress",
    color: "#D97706",
    badge: "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]",
    pill: "bg-[#D97706]",
  },
  Cancelled: {
    label: "Cancelled",
    color: "#DC2626",
    badge: "bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]",
    pill: "bg-[#DC2626]",
  },
};

function sessionEffectiveDate(session) {
  return session.overrideDate || session.scheduledDate || "";
}

function sessionEffectiveTime(session) {
  return session.overrideTime || session.time || "";
}

function getGreeting(name) {
  const hour = new Date().getHours();
  let timeGreeting = "Good evening";
  if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
  else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";

  const firstName = (name || "Coordinator").trim().split(" ")[0];
  return `${timeGreeting}, ${firstName}`;
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

    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
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

export default function CoordinatorDashboard({
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
  const [selectedGroupCode, setSelectedGroupCode] = useState("all");
  const [timeframe, setTimeframe] = useState("all"); // 'all' | 'upcoming' | 'this_month'
  const [searchQuery, setSearchQuery] = useState("");

  const today = cairoToday();

  // Coordinator display name & initials
  const coordinatorName =
    profile?.name ||
    profile?.displayName ||
    user?.displayName ||
    (user?.email || "Coordinator").split("@")[0];

  const initials = useMemo(() => {
    const parts = coordinatorName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return coordinatorName.slice(0, 2).toUpperCase();
  }, [coordinatorName]);

  // Available tracks across coordinator's assigned groups
  const availableTracks = useMemo(() => {
    return [
      ...new Set(groups.map((g) => g.trackName).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [groups]);

  // Students indexed by group
  const studentsByGroup = useMemo(() => {
    const map = new Map();
    for (const student of students) {
      const list = map.get(student.groupCode) || [];
      list.push(student);
      map.set(student.groupCode, list);
    }
    return map;
  }, [students]);

  // Sessions indexed by group
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
      if (selectedGroupCode !== "all" && g.groupCode !== selectedGroupCode) return false;
      if (term) {
        const text = [g.groupCode, g.trackName, g.batchCode, g.coachName, g.day]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }, [groups, selectedTrack, selectedGroupCode, searchQuery]);

  const filteredGroupCodes = useMemo(
    () => new Set(filteredGroups.map((g) => g.groupCode)),
    [filteredGroups],
  );

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const currentMonthPrefix = today.slice(0, 7); // YYYY-MM
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

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => filteredGroupCodes.has(s.groupCode));
  }, [students, filteredGroupCodes]);

  // Unique student count (deduplicating possible row replicates)
  const totalUniqueStudents = useMemo(() => {
    const seen = new Set();
    for (const st of filteredStudents) {
      const key = `${st.groupCode}:${st.userId || st.mobile || st.name}`;
      seen.add(key);
    }
    return seen.size;
  }, [filteredStudents]);

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

  // Pending Actions computation
  const pendingActions = useMemo(() => {
    const actions = [];

    // 1. Overdue sessions where status is still not Completed
    for (const s of filteredSessions) {
      const sDate = sessionEffectiveDate(s);
      if (
        sDate &&
        sDate < today &&
        s.status !== "Completed" &&
        s.status !== "Cancelled"
      ) {
        actions.push({
          id: `overdue:${s.id}`,
          type: "overdue_session",
          severity: "high",
          title: `Session ${s.sessionNumber} attendance pending`,
          groupCode: s.groupCode,
          description: `Group ${s.groupCode} was scheduled on ${dateLabel(
            sDate,
          )}. Status is "${s.status || "Scheduled"}".`,
          actionLabel: "Update Session",
          actionType: "session",
          session: s,
        });
      }
    }

    // 2. Upcoming sessions in next 48h missing a Zoom link
    for (const s of filteredSessions) {
      const sDate = sessionEffectiveDate(s);
      if (
        sDate &&
        sDate >= today &&
        s.status !== "Completed" &&
        s.status !== "Cancelled" &&
        !s.zoomLink
      ) {
        // Simple 2-day heuristic: compare dates
        const diffDays =
          (new Date(sDate).getTime() - new Date(today).getTime()) /
          (1000 * 3600 * 24);
        if (diffDays >= 0 && diffDays <= 2) {
          actions.push({
            id: `zoom:${s.id}`,
            type: "missing_zoom",
            severity: "medium",
            title: `Zoom link missing for Session ${s.sessionNumber}`,
            groupCode: s.groupCode,
            description: `Scheduled for ${dateLabel(sDate)} at ${
              sessionEffectiveTime(s) || "TBD"
            }.`,
            actionLabel: "Add Zoom Link",
            actionType: "session",
            session: s,
          });
        }
      }
    }

    // 3. Groups where fewer than 50% of students have joined the WhatsApp group
    for (const group of filteredGroups) {
      const gStudents = studentsByGroup.get(group.groupCode) || [];
      if (gStudents.length > 0) {
        const joined = gStudents.filter((st) => st.status === "دخل الجروب").length;
        const ratio = joined / gStudents.length;
        if (ratio < 0.4 && gStudents.length >= 3) {
          actions.push({
            id: `joined:${group.groupCode}`,
            type: "low_joined",
            severity: "low",
            title: `Low student engagement in ${group.groupCode}`,
            groupCode: group.groupCode,
            description: `Only ${joined} of ${gStudents.length} students have joined the group (${Math.round(
              ratio * 100,
            )}%).`,
            actionLabel: "Review Students",
            actionType: "group",
          });
        }
      }
    }

    return actions;
  }, [filteredSessions, filteredGroups, studentsByGroup, today]);

  // Map active assignment notifications by group
  const activeNotifMap = useMemo(() => {
    const map = new Map();
    for (const n of notifications) {
      if (n.groupCode && !n.superseded) {
        const existing = map.get(n.groupCode);
        if (
          !existing ||
          (n.createdAtDate?.getTime() || 0) > (existing.createdAtDate?.getTime() || 0)
        ) {
          map.set(n.groupCode, n);
        }
      }
    }
    return map;
  }, [notifications]);

  // Recently Assigned Groups (Sorted by most recent assignment event/timestamp)
  const recentlyAssignedGroups = useMemo(() => {
    return groups
      .map((g) => {
        const notif = activeNotifMap.get(g.groupCode);
        const assignedTimestamp =
          g.assignedAt ||
          notif?.createdAtDate ||
          notif?.createdAt ||
          null;

        const dateObj = assignedTimestamp?.toDate
          ? assignedTimestamp.toDate()
          : assignedTimestamp instanceof Date
          ? assignedTimestamp
          : assignedTimestamp
          ? new Date(assignedTimestamp)
          : null;

        const isReassignment =
          g.assignmentCount > 1 || notif?.type === "reassignment";

        return {
          ...g,
          assignedDateObj: dateObj,
          assignedDateFormatted: formatAssignmentTimestamp(dateObj, true),
          assignmentType: isReassignment ? "reassignment" : "new",
          assignmentBadge: isReassignment ? "Reassigned to You" : "New Assignment",
        };
      })
      .sort((a, b) => (b.assignedDateObj?.getTime() || 0) - (a.assignedDateObj?.getTime() || 0))
      .slice(0, 6);
  }, [groups, activeNotifMap]);

  // Assignment Activity Timeline
  const assignmentTimeline = useMemo(() => {
    // Use notifications and group assignment timestamps
    const items = notifications.map((n) => {
      const isSuperseded = Boolean(n.superseded);
      const isReassigned = n.type === "reassignment";
      const groupExistsInScope = groups.some((g) => g.groupCode === n.groupCode);

      return {
        id: n.id,
        groupCode: n.groupCode,
        trackName: n.trackName || "",
        dateObj: n.createdAtDate || new Date(),
        formattedDate: formatAssignmentTimestamp(n.createdAtDate),
        title: isReassigned
          ? `Group ${n.groupCode} reassigned to you`
          : `Group ${n.groupCode} assigned to you`,
        isSuperseded,
        isReassigned,
        isActive: !isSuperseded && groupExistsInScope,
      };
    });

    items.sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));
    return items.slice(0, 8);
  }, [notifications, groups]);

  // Next 5 Upcoming Sessions across coordinator's groups
  const nextUpcomingSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (!filteredGroupCodes.has(s.groupCode)) return false;
        if (s.status === "Completed" || s.status === "Cancelled") return false;
        const sDate = sessionEffectiveDate(s);
        return !sDate || sDate >= today;
      })
      .sort((a, b) => {
        const da = sessionEffectiveDate(a) || "9999-99-99";
        const db = sessionEffectiveDate(b) || "9999-99-99";
        return da.localeCompare(db);
      })
      .slice(0, 5);
  }, [sessions, filteredGroupCodes, today]);

  // Session Distribution for Donut Chart
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

  // Groups by Track for Bar Chart
  const trackChartData = useMemo(() => {
    const map = new Map();
    for (const g of filteredGroups) {
      const track = g.trackName || "Unspecified";
      map.set(track, (map.get(track) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([track, count]) => ({
        track: track.length > 18 ? `${track.slice(0, 16)}…` : track,
        fullTrack: track,
        groups: count,
      }))
      .sort((a, b) => b.groups - a.groups);
  }, [filteredGroups]);

  // Overall Sessions Completion Rate
  const sessionCompletionRate = useMemo(() => {
    if (!filteredSessions.length) return 0;
    return Math.round((completedSessionsCount / filteredSessions.length) * 100);
  }, [completedSessionsCount, filteredSessions.length]);

  // Average Students per Group
  const avgStudentsPerGroup = useMemo(() => {
    if (!filteredGroups.length) return 0;
    return (totalUniqueStudents / filteredGroups.length).toFixed(1);
  }, [totalUniqueStudents, filteredGroups.length]);

  const hasActiveFilters =
    selectedTrack !== "all" ||
    selectedGroupCode !== "all" ||
    timeframe !== "all" ||
    searchQuery.trim() !== "";

  function handleResetFilters() {
    setSelectedTrack("all");
    setSelectedGroupCode("all");
    setTimeframe("all");
    setSearchQuery("");
  }

  function handleOpenGroupDetail(groupCode) {
    if (onSelectGroup) {
      onSelectGroup(groupCode);
    }
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          SECTION A: Personalized Welcome Header
          ==================================================================== */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-[#F0EFFF]/40 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {/* Avatar with initials */}
            <div className="relative flex h-13 w-13 sm:h-15 sm:w-15 flex-none items-center justify-center rounded-2xl bg-gradient-to-tr from-[#483BFF] to-[#6366F1] text-lg sm:text-xl font-extrabold text-white shadow-md shadow-[#483BFF]/20 ring-4 ring-white">
              {initials}
              <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white" title="Online" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#483BFF]">
                  <Sparkles size={11} />
                  Coordinator Operations
                </span>
                <span className="hidden sm:inline-block text-xs text-slate-400">·</span>
                <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date())}
                </span>
              </div>

              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                {getGreeting(coordinatorName)}
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 truncate">
                Here's a comprehensive overview of your active coaching operations.
              </p>
            </div>
          </div>

          {/* Quick Notification Shortcut */}
          <div className="flex items-center gap-2.5 flex-none">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="inline-flex items-center gap-2 rounded-xl bg-[#EEF2FF] px-3.5 py-2 text-xs font-bold text-[#483BFF] hover:bg-[#E0E7FF] transition-all"
              >
                <Bell size={14} className="animate-pulse" />
                <span>{unreadCount} New Assignment{unreadCount > 1 ? "s" : ""}</span>
              </button>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-right shadow-2xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cairo Time
              </span>
              <span className="block font-mono text-xs font-bold text-slate-800">
                {today}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PART 10: Interactive Filters Bar
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            <Filter size={14} className="text-[#483BFF]" />
            <span>Dashboard Filters</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#483BFF] hover:text-[#3729E6] transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Track Filter */}
          <label className="block text-xs font-semibold text-slate-600">
            Track
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
            >
              <option value="all">All Tracks ({availableTracks.length})</option>
              {availableTracks.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
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
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
            >
              <option value="all">All Sessions</option>
              <option value="upcoming">Upcoming & Pending Only</option>
              <option value="this_month">This Month</option>
            </select>
          </label>

          {/* Search */}
          <label className="block text-xs font-semibold text-slate-600">
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
                placeholder="Search group, track, coach..."
                className="block w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
              />
            </div>
          </label>
        </div>
      </section>

      {/* ====================================================================
          SECTION B: 6 Main KPI Cards
          ==================================================================== */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* KPI 1: Active Groups */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Groups
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#483BFF]">
              <FolderKanban size={18} />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold text-[#483BFF] tracking-tight">
            {filteredGroups.length}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            Currently assigned
          </span>
        </div>

        {/* KPI 2: Total Students */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Students
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users size={18} />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {totalUniqueStudents}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            Under your supervision
          </span>
        </div>

        {/* KPI 3: Total Sessions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Sessions
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <CalendarDays size={18} />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {filteredSessions.length}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            Scheduled coaching
          </span>
        </div>

        {/* KPI 4: Completed Sessions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Completed
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
            {completedSessionsCount}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            {sessionCompletionRate}% completion rate
          </span>
        </div>

        {/* KPI 5: Upcoming Sessions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Upcoming
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock size={18} />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
            {upcomingSessionsCount}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            Next scheduled dates
          </span>
        </div>

        {/* KPI 6: Pending Actions */}
        <div className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm ${
          pendingActions.length > 0
            ? "border-amber-200 bg-amber-50/40"
            : "border-slate-200/80 bg-white"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Needs Attention
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertCircle size={18} />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">
            {pendingActions.length}
          </strong>
          <span className="mt-1 block text-xs text-amber-700/80">
            {pendingActions.length > 0 ? "Requires your follow-up" : "All caught up"}
          </span>
        </div>
      </section>

      {/* ====================================================================
          PART 9: Needs Your Attention Section (Actionable alerts)
          ==================================================================== */}
      {pendingActions.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-700 flex-none" />
              <h2 className="text-base font-bold text-amber-950">
                Needs Your Attention ({pendingActions.length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-800">
              Operational follow-ups
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="flex flex-col justify-between rounded-xl border border-amber-200/90 bg-white p-3.5 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#3729E6]">
                      {action.groupCode}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      action.severity === "high"
                        ? "bg-rose-100 text-rose-700"
                        : action.severity === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {action.severity} priority
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {action.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (action.actionType === "session" && onNavigateToSessions) {
                        onNavigateToSessions(action.groupCode, action.session?.sessionNumber);
                      } else {
                        handleOpenGroupDetail(action.groupCode);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#483BFF] hover:text-[#3729E6] transition-colors"
                  >
                    <span>{action.actionLabel}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====================================================================
          PART 5: Recently Assigned to Me (Highly Prominent)
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#483BFF]">
                <Sparkles size={14} />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Recently Assigned to Me
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Groups newly assigned or recently transferred to your operational responsibility.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Sorted by most recent
          </span>
        </div>

        {recentlyAssignedGroups.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <FolderKanban size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No assigned groups found.</p>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {recentlyAssignedGroups.map((g) => {
              const isReassignment = g.assignmentType === "reassignment";
              const gStudents = studentsByGroup.get(g.groupCode) || [];

              return (
                <div
                  key={g.groupCode}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-[#F8F9FC] p-4 shadow-2xs hover:border-[#483BFF]/40 hover:shadow-xs transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-sm font-extrabold text-slate-900">
                        {g.groupCode}
                      </span>
                      <StatusBadge
                        status={isReassignment ? "reassigned" : "new assignment"}
                        label={isReassignment ? "Reassigned to You" : "New Assignment"}
                        size="sm"
                      />
                    </div>

                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {g.trackName || "Track Not Specified"}
                    </p>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        <span>Assigned: <strong>{g.assignedDateFormatted}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={13} className="text-slate-400" />
                        <span>Students: <strong>{gStudents.length} enrolled</strong></span>
                      </div>
                      {g.day && g.time && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>Schedule: <strong>{g.day} at {g.time}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400">
                      Coach: {g.coachName || "TBD"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenGroupDetail(g.groupCode)}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-[#483BFF] border border-slate-200 hover:bg-[#EEF2FF] hover:border-[#483BFF] active:scale-95 transition-all shadow-2xs"
                    >
                      <span>View Group</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ====================================================================
          PART 4: My Groups Section (Full Cards with Progress)
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound size={18} className="text-[#483BFF]" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                My Active Groups ({filteredGroups.length})
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Detailed progress and next upcoming sessions for your groups.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-400">
            {filteredGroups.length} accessible group{filteredGroups.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <UsersRound size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No groups match your current filter.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#483BFF]"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((g) => {
              const gStudents = studentsByGroup.get(g.groupCode) || [];
              const gSessions = sessionsByGroup.get(g.groupCode) || [];
              const gCompletedSessions = gSessions.filter((s) => s.status === "Completed").length;
              const gTotalSessions = gSessions.length || 10;
              const progressPct = Math.round((gCompletedSessions / gTotalSessions) * 100);

              // Find next upcoming session
              const nextSession = gSessions
                .filter((s) => s.status !== "Completed" && s.status !== "Cancelled")
                .sort((a, b) => {
                  const da = sessionEffectiveDate(a) || "9999-99-99";
                  const db = sessionEffectiveDate(b) || "9999-99-99";
                  return da.localeCompare(db);
                })[0];

              const notif = activeNotifMap.get(g.groupCode);
              const assignedTimestamp =
                g.assignedAt || notif?.createdAtDate || notif?.createdAt || null;

              const opStatus =
                progressPct === 100
                  ? "Completed"
                  : gCompletedSessions > 0
                  ? "In progress"
                  : "Active";

              return (
                <div
                  key={g.groupCode}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-[#483BFF]/50 hover:shadow-md transition-all"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 font-mono text-xs font-bold text-[#3729E6]">
                            {g.groupCode}
                          </span>
                          <StatusBadge status={opStatus} size="sm" />
                        </div>
                        <h3 className="mt-1.5 text-sm font-bold text-slate-900 truncate" title={g.trackName}>
                          {g.trackName || "Track Not Specified"}
                        </h3>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {gStudents.length} students
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                        <span>Sessions Progress</span>
                        <span className="font-bold text-slate-900">
                          {gCompletedSessions} / {gTotalSessions} ({progressPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#483BFF] to-[#6366F1] transition-all duration-300"
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Group Details */}
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Start Date:</span>
                        <span className="font-semibold text-slate-800">
                          {dateLabel(g.startDate) || "TBD"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Coach:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                          {g.coachName || "Unassigned"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Assigned to you:</span>
                        <span className="text-slate-600 truncate max-w-[170px]" title={formatAssignmentTimestamp(assignedTimestamp, false)}>
                          {formatAssignmentTimestamp(assignedTimestamp, false)}
                        </span>
                      </div>

                      {/* Next Session indicator */}
                      <div className="mt-2 rounded-xl bg-slate-50 p-2.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Next Upcoming Session
                        </span>
                        {nextSession ? (
                          <div className="mt-0.5 flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>Session #{nextSession.sessionNumber}</span>
                            <span className="text-[#483BFF]">
                              {dateLabel(sessionEffectiveDate(nextSession))}
                              {sessionEffectiveTime(nextSession) ? ` at ${sessionEffectiveTime(nextSession)}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">
                            All sessions completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenGroupDetail(g.groupCode)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EEF2FF] py-2 text-xs font-bold text-[#3729E6] hover:bg-[#E0E7FF] transition-all"
                    >
                      <span>View Group</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ====================================================================
          PART 7: Sessions Overview (Charts + Next Upcoming Sessions)
          ==================================================================== */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Left: Session Status Distribution Donut Chart */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Sessions Overview
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {filteredSessions.length} total sessions
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Distribution of sessions by completion and scheduling status.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-6">
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
                    {sessionCompletionRate}%
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Completed
                  </span>
                </div>
              </div>

              {/* Status Legend breakdown */}
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
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Overall coaching progress</span>
            <span className="font-bold text-[#483BFF]">
              {completedSessionsCount} of {filteredSessions.length} completed
            </span>
          </div>
        </div>

        {/* Right: Next 5 Upcoming Sessions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Upcoming Sessions
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                Next 5 on schedule
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Immediate upcoming coaching sessions requiring attendance & management.
            </p>

            <div className="mt-4 divide-y divide-slate-100">
              {nextUpcomingSessions.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No upcoming sessions scheduled.</p>
                </div>
              ) : (
                nextUpcomingSessions.map((sess) => {
                  const sDate = sessionEffectiveDate(sess);
                  const sTime = sessionEffectiveTime(sess);

                  return (
                    <div
                      key={sess.id}
                      className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50/70 px-2 rounded-xl transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 font-mono text-xs font-bold text-[#3729E6]">
                            {sess.groupCode}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            Session #{sess.sessionNumber}
                          </span>
                          <StatusBadge
                            status={sess.overrideDate ? "rescheduled" : (sess.status || "scheduled")}
                            size="sm"
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {dateLabel(sDate)}
                          </span>
                          {sTime && <span>· {sTime}</span>}
                          {sess.coachName && (
                            <span className="hidden sm:inline">
                              · Coach: {sess.coachName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-none">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToSessions) {
                              onNavigateToSessions(sess.groupCode, sess.sessionNumber);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#483BFF] hover:text-[#483BFF] transition-all shadow-2xs"
                        >
                          <span>View Session</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={() => onNavigateToSessions && onNavigateToSessions()}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#483BFF] hover:text-[#3729E6]"
            >
              <span>View all sessions in Sessions page</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          PART 8: Group Workload Analytics (Bar Chart + Workload Summary)
          ==================================================================== */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Groups by Track Bar Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Groups by Track
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Workload distribution
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Number of assigned groups distributed across academic tracks.
          </p>

          {trackChartData.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Layers size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No track data available.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trackChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
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
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullTrack || label}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    }}
                  />
                  <Bar dataKey="groups" fill="#483BFF" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Compact Workload Summary */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight mb-1">
              Workload Summary
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Operational load and student density metrics.
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Active Groups
                </span>
                <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                  {filteredGroups.length}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Assigned Students
                </span>
                <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                  {totalUniqueStudents}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Avg. Students per Group
                </span>
                <strong className="mt-1 block text-xl font-extrabold text-slate-900">
                  {avgStudentsPerGroup}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Overall Completion Rate
                </span>
                <strong className="mt-1 block text-xl font-extrabold text-emerald-600">
                  {sessionCompletionRate}%
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 text-center">
            Updated in real-time via Firestore
          </div>
        </div>
      </section>

      {/* ====================================================================
          PART 6: Assignment Activity Timeline
          ==================================================================== */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Assignment Activity Timeline
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Audit trail of group assignment and reassignment events.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Real assignment events
          </span>
        </div>

        {assignmentTimeline.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Clock size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No assignment history recorded yet.</p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-4">
            {assignmentTimeline.map((item) => (
              <div key={item.id} className="relative flex items-start justify-between gap-3">
                {/* Timeline node */}
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
                    {item.isSuperseded ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Superseded · Reassigned away
                      </span>
                    ) : item.isReassigned ? (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Reassigned to You
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Initial Assignment
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {item.formattedDate}
                    </span>
                  </div>

                  <p className={`mt-0.5 text-xs ${item.isSuperseded ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {item.title}
                  </p>
                </div>

                {item.isActive && (
                  <button
                    type="button"
                    onClick={() => handleOpenGroupDetail(item.groupCode)}
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
      </section>
    </div>
  );
}
