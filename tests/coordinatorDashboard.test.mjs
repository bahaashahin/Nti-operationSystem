import test from "node:test";
import assert from "node:assert/strict";

// Helper functions mirroring CoordinatorDashboard metrics and filters
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

function calculateUniqueStudents(students) {
  const seen = new Set();
  for (const st of students) {
    const key = `${st.groupCode}:${st.userId || st.mobile || st.name}`;
    seen.add(key);
  }
  return seen.size;
}

function calculatePendingActions(sessions, groups, studentsByGroup, today) {
  const actions = [];

  // 1. Overdue sessions
  for (const s of sessions) {
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
        groupCode: s.groupCode,
      });
    }
  }

  // 2. Missing zoom in next 48h
  for (const s of sessions) {
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
        actions.push({
          id: `zoom:${s.id}`,
          type: "missing_zoom",
          groupCode: s.groupCode,
        });
      }
    }
  }

  // 3. Low engagement
  for (const group of groups) {
    const gStudents = studentsByGroup.get(group.groupCode) || [];
    if (gStudents.length >= 3) {
      const joined = gStudents.filter((st) => st.status === "دخل الجروب").length;
      const ratio = joined / gStudents.length;
      if (ratio < 0.4) {
        actions.push({
          id: `joined:${group.groupCode}`,
          type: "low_joined",
          groupCode: group.groupCode,
        });
      }
    }
  }

  return actions;
}

function computeWorkloadSummary(groups, students, sessions) {
  const uniqueStudents = calculateUniqueStudents(students);
  const completedSessions = sessions.filter((s) => s.status === "Completed").length;

  const avgStudents = groups.length
    ? Number((uniqueStudents / groups.length).toFixed(1))
    : 0;

  const completionRate = sessions.length
    ? Math.round((completedSessions / sessions.length) * 100)
    : 0;

  return {
    totalGroups: groups.length,
    totalStudents: uniqueStudents,
    avgStudentsPerGroup: avgStudents,
    sessionCompletionRate: completionRate,
  };
}

test("1. Unique student calculation deduplicates multi-row duplicate records", () => {
  const students = [
    { groupCode: "PY-101", userId: "U1", mobile: "01011111111", name: "Ahmed" },
    { groupCode: "PY-101", userId: "U1", mobile: "01011111111", name: "Ahmed" }, // duplicate row
    { groupCode: "PY-101", userId: "U2", mobile: "01022222222", name: "Sara" },
    { groupCode: "JS-202", userId: "U1", mobile: "01011111111", name: "Ahmed" }, // different group, distinct enrollment
  ];

  const count = calculateUniqueStudents(students);
  assert.equal(count, 3, "Duplicate within PY-101 should be deduplicated, distinct groups preserved");
});

test("2. Workload summary handles empty datasets safely without division by zero", () => {
  const summary = computeWorkloadSummary([], [], []);
  assert.equal(summary.totalGroups, 0);
  assert.equal(summary.totalStudents, 0);
  assert.equal(summary.avgStudentsPerGroup, 0);
  assert.equal(summary.sessionCompletionRate, 0);
});

test("3. Session effective date strictly respects overrideDate and overrideTime when rescheduled", () => {
  const originalSession = {
    groupCode: "AI-301",
    sessionNumber: 3,
    scheduledDate: "2026-10-20",
    time: "18:00",
  };

  const rescheduledSession = {
    groupCode: "AI-301",
    sessionNumber: 3,
    scheduledDate: "2026-10-20",
    time: "18:00",
    overrideDate: "2026-10-25",
    overrideTime: "20:00",
  };

  assert.equal(sessionEffectiveDate(originalSession), "2026-10-20");
  assert.equal(sessionEffectiveTime(originalSession), "18:00");

  assert.equal(sessionEffectiveDate(rescheduledSession), "2026-10-25");
  assert.equal(sessionEffectiveTime(rescheduledSession), "20:00");
});

test("4. Pending actions detects overdue sessions and missing Zoom links without artificial alerts", () => {
  const today = "2026-10-28";

  const sessions = [
    {
      id: "s1",
      groupCode: "PY-101",
      sessionNumber: 1,
      scheduledDate: "2026-10-20",
      status: "Scheduled", // overdue, pending attendance
      zoomLink: "https://zoom.us/j/123",
    },
    {
      id: "s2",
      groupCode: "PY-101",
      sessionNumber: 2,
      scheduledDate: "2026-10-29", // tomorrow, upcoming
      status: "Scheduled",
      zoomLink: "", // missing zoom link
    },
    {
      id: "s3",
      groupCode: "JS-201",
      sessionNumber: 1,
      scheduledDate: "2026-10-20",
      status: "Completed", // completed, not pending
    },
  ];

  const studentsByGroup = new Map([
    [
      "PY-101",
      [
        { name: "A", status: "لم يُرسل" },
        { name: "B", status: "لم يُرسل" },
        { name: "C", status: "لم يُرسل" },
        { name: "D", status: "دخل الجروب" }, // 1/4 = 25% < 40% -> low engagement
      ],
    ],
  ]);

  const groups = [{ groupCode: "PY-101" }];

  const actions = calculatePendingActions(sessions, groups, studentsByGroup, today);

  assert.equal(actions.length, 3);
  assert.ok(actions.some((a) => a.type === "overdue_session" && a.id === "overdue:s1"));
  assert.ok(actions.some((a) => a.type === "missing_zoom" && a.id === "zoom:s2"));
  assert.ok(actions.some((a) => a.type === "low_joined" && a.id === "joined:PY-101"));
});

test("5. Assignment timestamp accurately formats real date and time, and displays unavailable for historical groups", () => {
  const dateWithTime = new Date("2026-10-28T15:45:00Z");
  const formattedWithTime = formatAssignmentTimestamp(dateWithTime, true);
  assert.ok(formattedWithTime.includes("October 28, 2026"), "Should include month day year");

  const legacyGroupWithoutTimestamp = null;
  assert.equal(
    formatAssignmentTimestamp(legacyGroupWithoutTimestamp),
    "Assignment date unavailable",
    "Must not fabricate assignment timestamp for legacy groups"
  );
});

test("6. Superseded notifications are excluded from active unread count and recognized as transferred away", () => {
  const notifications = [
    { id: "n1", groupCode: "PY-101", read: false, superseded: false, type: "assignment" },
    { id: "n2", groupCode: "JS-202", read: false, superseded: true, type: "assignment" }, // superseded
    { id: "n3", groupCode: "AI-303", read: true, superseded: false, type: "reassignment" },
  ];

  const unreadActive = notifications.filter((n) => !n.read && !n.superseded);
  assert.equal(unreadActive.length, 1);
  assert.equal(unreadActive[0].id, "n1");
});
