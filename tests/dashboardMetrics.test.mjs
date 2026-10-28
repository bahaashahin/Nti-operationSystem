import test from "node:test";
import assert from "node:assert/strict";

// Helper functions mirroring LeadDashboard and ProjectManagerDashboard logic

function sessionEffectiveDate(session) {
  return session.overrideDate || session.scheduledDate || "";
}

function sessionEffectiveTime(session) {
  return session.overrideTime || session.time || "";
}

function calculateUniqueStudents(students) {
  const seen = new Set();
  for (const st of students) {
    const key = `${st.groupCode}:${st.userId || st.mobile || st.name}`;
    seen.add(key);
  }
  return seen.size;
}

// Lead Dashboard metrics calculator
function calculateLeadMetrics({ groups = [], students = [], sessions = [], today = "2026-10-28" }) {
  const activeGroups = groups.filter(
    (g) => (g.status || "active").toLowerCase() !== "archived" && (g.status || "active").toLowerCase() !== "completed"
  );

  const totalStudents = calculateUniqueStudents(students);

  const activeCoordinators = new Set(
    groups
      .map((g) => (g.coordinator || g.assignedToName || "").trim())
      .filter(Boolean)
  );

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "completed").length;
  const inProgressSessions = sessions.filter((s) => s.status === "in_progress").length;
  const cancelledSessions = sessions.filter((s) => s.status === "cancelled").length;
  const scheduledSessions = sessions.filter(
    (s) => !s.status || s.status === "scheduled" || s.status === "pending"
  ).length;

  const pendingUpcomingSessions = sessions.filter(
    (s) => s.status !== "completed" && s.status !== "cancelled"
  ).length;

  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Coordinator workload
  const workloadMap = new Map();
  for (const group of groups) {
    const coord = (group.coordinator || group.assignedToName || "Unassigned").trim();
    if (!workloadMap.has(coord)) {
      workloadMap.set(coord, {
        coordinatorName: coord,
        assignedGroups: 0,
        totalStudents: 0,
        completedSessions: 0,
        pendingSessions: 0,
        totalSessions: 0,
      });
    }
    const entry = workloadMap.get(coord);
    entry.assignedGroups += 1;
  }

  // Count students per coordinator
  for (const st of students) {
    const group = groups.find((g) => g.code === st.groupCode);
    const coord = (group?.coordinator || group?.assignedToName || "Unassigned").trim();
    if (workloadMap.has(coord)) {
      workloadMap.get(coord).totalStudents += 1;
    }
  }

  // Count sessions per coordinator
  for (const s of sessions) {
    const group = groups.find((g) => g.code === s.groupCode);
    const coord = (group?.coordinator || group?.assignedToName || "Unassigned").trim();
    if (workloadMap.has(coord)) {
      const entry = workloadMap.get(coord);
      entry.totalSessions += 1;
      if (s.status === "completed") {
        entry.completedSessions += 1;
      } else if (s.status !== "cancelled") {
        entry.pendingSessions += 1;
      }
    }
  }

  const coordinatorWorkload = Array.from(workloadMap.values()).map((c) => {
    const rate = c.totalSessions > 0 ? Math.round((c.completedSessions / c.totalSessions) * 100) : 0;
    let workloadIndicator = "Balanced";
    if (c.assignedGroups > 6) {
      workloadIndicator = "Heavy Load";
    } else if (c.assignedGroups < 3) {
      workloadIndicator = "Light Load";
    }
    return {
      ...c,
      completionRate: rate,
      workloadIndicator,
    };
  });

  // Groups by track
  const trackMap = new Map();
  for (const g of groups) {
    const track = (g.track || "Unassigned Track").trim();
    trackMap.set(track, (trackMap.get(track) || 0) + 1);
  }
  const groupsByTrack = Array.from(trackMap.entries()).map(([track, count]) => ({
    track,
    count,
  }));

  // Groups requiring attention
  const attentionGroups = [];
  for (const g of groups) {
    const issues = [];
    if (!g.coordinator && !g.assignedToName) {
      issues.push("Unassigned Coordinator");
    }
    if (!g.zoomLink && !g.meetingLink) {
      issues.push("Missing Meeting Link");
    }
    const groupSessions = sessions.filter((s) => s.groupCode === g.code);
    const overdue = groupSessions.filter(
      (s) => sessionEffectiveDate(s) < today && s.status !== "completed" && s.status !== "cancelled"
    );
    if (overdue.length > 0) {
      issues.push(`${overdue.length} Overdue Session(s)`);
    }
    if (issues.length > 0) {
      attentionGroups.push({
        groupCode: g.code,
        track: g.track || "General",
        coordinator: g.coordinator || "Unassigned",
        issues,
      });
    }
  }

  return {
    activeGroupsCount: activeGroups.length,
    totalStudents,
    activeCoordinatorsCount: activeCoordinators.size,
    totalSessions,
    completedSessions,
    inProgressSessions,
    cancelledSessions,
    scheduledSessions,
    pendingUpcomingSessions,
    completionRate,
    coordinatorWorkload,
    groupsByTrack,
    attentionGroups,
  };
}

// Project Manager Dashboard metrics calculator
function calculatePMMetrics({ groups = [], students = [], sessions = [], today = "2026-10-28" }) {
  const groupsUnderManagement = groups.length;

  const assignedCoordinators = new Set(
    groups
      .map((g) => (g.coordinator || g.assignedToName || "").trim())
      .filter(Boolean)
  );

  const totalStudents = calculateUniqueStudents(students);

  const upcomingSessions = sessions.filter(
    (s) => sessionEffectiveDate(s) >= today && s.status !== "completed" && s.status !== "cancelled"
  );

  const overdueSessions = sessions.filter(
    (s) => sessionEffectiveDate(s) < today && s.status !== "completed" && s.status !== "cancelled"
  );

  // Today's Operations
  const todaySessions = sessions.filter((s) => sessionEffectiveDate(s) === today);
  const completedToday = todaySessions.filter((s) => s.status === "completed");
  const pendingToday = todaySessions.filter((s) => s.status !== "completed" && s.status !== "cancelled");
  const rescheduledToday = sessions.filter(
    (s) => s.overrideDate === today && s.scheduledDate !== today
  );

  // Next 7 days
  const future7DaysDate = new Date(today);
  future7DaysDate.setDate(future7DaysDate.getDate() + 7);
  const future7DaysStr = future7DaysDate.toISOString().split("T")[0];

  const upcoming7DaysSessions = sessions
    .filter((s) => {
      const ed = sessionEffectiveDate(s);
      return ed >= today && ed <= future7DaysStr && s.status !== "completed" && s.status !== "cancelled";
    })
    .sort((a, b) => {
      const dateA = `${sessionEffectiveDate(a)} ${sessionEffectiveTime(a)}`;
      const dateB = `${sessionEffectiveDate(b)} ${sessionEffectiveTime(b)}`;
      return dateA.localeCompare(dateB);
    });

  // Group Progress Tracker
  const groupProgress = groups.map((g) => {
    const grpSessions = sessions.filter((s) => s.groupCode === g.code);
    const completed = grpSessions.filter((s) => s.status === "completed").length;
    const total = grpSessions.length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const futureSessions = grpSessions
      .filter((s) => sessionEffectiveDate(s) >= today && s.status !== "completed")
      .sort((a, b) => sessionEffectiveDate(a).localeCompare(sessionEffectiveDate(b)));

    const nextSession = futureSessions[0] || null;

    return {
      groupCode: g.code,
      track: g.track || "General",
      coordinator: g.coordinator || "Unassigned",
      studentCount: students.filter((st) => st.groupCode === g.code).length,
      sessionsCompleted: completed,
      totalSessions: total,
      progressPercentage: progressPct,
      nextSessionDate: nextSession ? sessionEffectiveDate(nextSession) : null,
      status: g.status || "active",
    };
  });

  return {
    groupsUnderManagement,
    assignedCoordinatorsCount: assignedCoordinators.size,
    totalStudents,
    upcomingSessionsCount: upcomingSessions.length,
    overdueSessionsCount: overdueSessions.length,
    todaySessionsCount: todaySessions.length,
    completedTodayCount: completedToday.length,
    pendingTodayCount: pendingToday.length,
    rescheduledTodayCount: rescheduledToday.length,
    upcoming7DaysSessions,
    groupProgress,
  };
}

// --- TESTS ---

test("Lead Dashboard KPI calculations with realistic data", () => {
  const groups = [
    { code: "GRP-01", track: "Front-End", coordinator: "Ahmed Ali", status: "active" },
    { code: "GRP-02", track: "Back-End", coordinator: "Sara Mohamed", status: "active" },
    { code: "GRP-03", track: "Front-End", coordinator: "Ahmed Ali", status: "completed" },
    { code: "GRP-04", track: "Mobile", coordinator: "", status: "active" },
  ];

  const students = [
    { id: "s1", groupCode: "GRP-01", name: "User 1", mobile: "01011111111" },
    { id: "s2", groupCode: "GRP-01", name: "User 2", mobile: "01022222222" },
    { id: "s3", groupCode: "GRP-02", name: "User 3", mobile: "01033333333" },
    // duplicate entry for same student in same group
    { id: "s1_dup", groupCode: "GRP-01", name: "User 1", mobile: "01011111111" },
  ];

  const sessions = [
    { id: "sess-1", groupCode: "GRP-01", scheduledDate: "2026-10-20", status: "completed" },
    { id: "sess-2", groupCode: "GRP-01", scheduledDate: "2026-10-27", status: "completed" },
    { id: "sess-3", groupCode: "GRP-01", scheduledDate: "2026-11-03", status: "scheduled" },
    { id: "sess-4", groupCode: "GRP-02", scheduledDate: "2026-10-25", status: "cancelled" },
    { id: "sess-5", groupCode: "GRP-02", scheduledDate: "2026-10-30", status: "scheduled" },
  ];

  const metrics = calculateLeadMetrics({ groups, students, sessions, today: "2026-10-28" });

  assert.equal(metrics.activeGroupsCount, 3); // GRP-01, GRP-02, GRP-04 (GRP-03 is completed)
  assert.equal(metrics.totalStudents, 3); // s1_dup deduplicated
  assert.equal(metrics.activeCoordinatorsCount, 2); // Ahmed Ali, Sara Mohamed (GRP-04 empty)
  assert.equal(metrics.totalSessions, 5);
  assert.equal(metrics.completedSessions, 2);
  assert.equal(metrics.cancelledSessions, 1);
  assert.equal(metrics.scheduledSessions, 2);
  assert.equal(metrics.pendingUpcomingSessions, 2); // sess-3 and sess-5
  assert.equal(metrics.completionRate, 40); // 2 / 5 = 40%
});

test("Lead Dashboard handles empty dataset cleanly without division by zero", () => {
  const metrics = calculateLeadMetrics({ groups: [], students: [], sessions: [], today: "2026-10-28" });

  assert.equal(metrics.activeGroupsCount, 0);
  assert.equal(metrics.totalStudents, 0);
  assert.equal(metrics.activeCoordinatorsCount, 0);
  assert.equal(metrics.totalSessions, 0);
  assert.equal(metrics.completedSessions, 0);
  assert.equal(metrics.completionRate, 0);
  assert.deepEqual(metrics.coordinatorWorkload, []);
  assert.deepEqual(metrics.groupsByTrack, []);
  assert.deepEqual(metrics.attentionGroups, []);
});

test("Lead Dashboard Coordinator Workload distribution & categorization", () => {
  const groups = [
    { code: "G1", coordinator: "Coordinator A", status: "active" },
    { code: "G2", coordinator: "Coordinator A", status: "active" },
    { code: "G3", coordinator: "Coordinator A", status: "active" },
    { code: "G4", coordinator: "Coordinator A", status: "active" },
    { code: "G5", coordinator: "Coordinator A", status: "active" },
    { code: "G6", coordinator: "Coordinator A", status: "active" },
    { code: "G7", coordinator: "Coordinator A", status: "active" }, // 7 groups -> Heavy Load
    { code: "G8", coordinator: "Coordinator B", status: "active" },
    { code: "G9", coordinator: "Coordinator B", status: "active" },
    { code: "G10", coordinator: "Coordinator B", status: "active" },
    { code: "G11", coordinator: "Coordinator B", status: "active" }, // 4 groups -> Balanced
    { code: "G12", coordinator: "Coordinator C", status: "active" }, // 1 group -> Light Load
  ];

  const sessions = [
    { id: "s1", groupCode: "G1", status: "completed" },
    { id: "s2", groupCode: "G1", status: "completed" },
    { id: "s3", groupCode: "G1", status: "scheduled" },
  ];

  const metrics = calculateLeadMetrics({ groups, students: [], sessions, today: "2026-10-28" });
  const coordA = metrics.coordinatorWorkload.find((c) => c.coordinatorName === "Coordinator A");
  const coordB = metrics.coordinatorWorkload.find((c) => c.coordinatorName === "Coordinator B");
  const coordC = metrics.coordinatorWorkload.find((c) => c.coordinatorName === "Coordinator C");

  assert.ok(coordA);
  assert.equal(coordA.assignedGroups, 7);
  assert.equal(coordA.workloadIndicator, "Heavy Load");
  assert.equal(coordA.completedSessions, 2);
  assert.equal(coordA.pendingSessions, 1);
  assert.equal(coordA.completionRate, 67);

  assert.ok(coordB);
  assert.equal(coordB.assignedGroups, 4);
  assert.equal(coordB.workloadIndicator, "Balanced");

  assert.ok(coordC);
  assert.equal(coordC.assignedGroups, 1);
  assert.equal(coordC.workloadIndicator, "Light Load");
});

test("Lead Dashboard Attention Required detection", () => {
  const groups = [
    { code: "G-UNASSIGNED", coordinator: "", zoomLink: "https://zoom.us/j/123", track: "Track A" },
    { code: "G-NO-ZOOM", coordinator: "Ahmed", zoomLink: "", track: "Track B" },
    { code: "G-OVERDUE", coordinator: "Sara", zoomLink: "https://zoom.us/j/456", track: "Track C" },
    { code: "G-HEALTHY", coordinator: "Sara", zoomLink: "https://zoom.us/j/789", track: "Track C" },
  ];

  const sessions = [
    { id: "s-overdue", groupCode: "G-OVERDUE", scheduledDate: "2026-10-20", status: "scheduled" }, // overdue
    { id: "s-future", groupCode: "G-HEALTHY", scheduledDate: "2026-11-01", status: "scheduled" },
  ];

  const metrics = calculateLeadMetrics({ groups, students: [], sessions, today: "2026-10-28" });

  assert.equal(metrics.attentionGroups.length, 3);
  const unassigned = metrics.attentionGroups.find((g) => g.groupCode === "G-UNASSIGNED");
  assert.ok(unassigned.issues.includes("Unassigned Coordinator"));

  const noZoom = metrics.attentionGroups.find((g) => g.groupCode === "G-NO-ZOOM");
  assert.ok(noZoom.issues.includes("Missing Meeting Link"));

  const overdue = metrics.attentionGroups.find((g) => g.groupCode === "G-OVERDUE");
  assert.ok(overdue.issues.some((i) => i.includes("Overdue Session")));
});

test("Project Manager Dashboard KPI & Today Operations calculations", () => {
  const groups = [
    { code: "PM-GRP-1", track: "Data Analysis", coordinator: "Mona" },
    { code: "PM-GRP-2", track: "Data Analysis", coordinator: "Mona" },
    { code: "PM-GRP-3", track: "Graphic Design", coordinator: "Tarek" },
  ];

  const students = [
    { id: "p1", groupCode: "PM-GRP-1", name: "Student 1" },
    { id: "p2", groupCode: "PM-GRP-2", name: "Student 2" },
    { id: "p3", groupCode: "PM-GRP-3", name: "Student 3" },
  ];

  const sessions = [
    // Today sessions (2026-10-28)
    { id: "t1", groupCode: "PM-GRP-1", scheduledDate: "2026-10-28", status: "completed" },
    { id: "t2", groupCode: "PM-GRP-2", scheduledDate: "2026-10-28", status: "scheduled" },
    // Rescheduled to today
    { id: "t3", groupCode: "PM-GRP-3", scheduledDate: "2026-10-25", overrideDate: "2026-10-28", status: "scheduled" },
    // Overdue session
    { id: "od1", groupCode: "PM-GRP-1", scheduledDate: "2026-10-21", status: "scheduled" },
    // Upcoming session within 7 days (2026-10-31)
    { id: "up1", groupCode: "PM-GRP-2", scheduledDate: "2026-10-31", time: "18:00", status: "scheduled" },
    // Upcoming session beyond 7 days (2026-11-15)
    { id: "up2", groupCode: "PM-GRP-3", scheduledDate: "2026-11-15", time: "14:00", status: "scheduled" },
  ];

  const pmMetrics = calculatePMMetrics({ groups, students, sessions, today: "2026-10-28" });

  assert.equal(pmMetrics.groupsUnderManagement, 3);
  assert.equal(pmMetrics.assignedCoordinatorsCount, 2);
  assert.equal(pmMetrics.totalStudents, 3);
  assert.equal(pmMetrics.overdueSessionsCount, 1); // od1
  assert.equal(pmMetrics.todaySessionsCount, 3); // t1, t2, and t3 (effective date is today)
  assert.equal(pmMetrics.completedTodayCount, 1); // t1
  assert.equal(pmMetrics.pendingTodayCount, 2); // t2 and t3
  assert.equal(pmMetrics.rescheduledTodayCount, 1); // t3
  assert.equal(pmMetrics.upcoming7DaysSessions.length, 3); // t2, t3, up1 (t1 completed)
});

test("Project Manager Group Progress Tracker calculations", () => {
  const groups = [
    { code: "GRP-ALPHA", track: "Cybersecurity", coordinator: "Youssef" },
  ];

  const students = [
    { id: "st-1", groupCode: "GRP-ALPHA", name: "Ali" },
    { id: "st-2", groupCode: "GRP-ALPHA", name: "Omar" },
  ];

  const sessions = [
    { id: "s1", groupCode: "GRP-ALPHA", scheduledDate: "2026-10-10", status: "completed" },
    { id: "s2", groupCode: "GRP-ALPHA", scheduledDate: "2026-10-17", status: "completed" },
    { id: "s3", groupCode: "GRP-ALPHA", scheduledDate: "2026-10-24", status: "completed" },
    { id: "s4", groupCode: "GRP-ALPHA", scheduledDate: "2026-10-31", status: "scheduled" },
  ];

  const pmMetrics = calculatePMMetrics({ groups, students, sessions, today: "2026-10-28" });
  assert.equal(pmMetrics.groupProgress.length, 1);

  const alpha = pmMetrics.groupProgress[0];
  assert.equal(alpha.groupCode, "GRP-ALPHA");
  assert.equal(alpha.sessionsCompleted, 3);
  assert.equal(alpha.totalSessions, 4);
  assert.equal(alpha.progressPercentage, 75); // 3 / 4 * 100 = 75%
  assert.equal(alpha.studentCount, 2);
  assert.equal(alpha.nextSessionDate, "2026-10-31");
});

test("Date and time override precedence works consistently", () => {
  const sessionWithOverride = {
    id: "override-1",
    scheduledDate: "2026-10-15",
    time: "10:00",
    overrideDate: "2026-10-29",
    overrideTime: "16:30",
  };

  const sessionWithoutOverride = {
    id: "standard-1",
    scheduledDate: "2026-10-15",
    time: "10:00",
  };

  assert.equal(sessionEffectiveDate(sessionWithOverride), "2026-10-29");
  assert.equal(sessionEffectiveTime(sessionWithOverride), "16:30");

  assert.equal(sessionEffectiveDate(sessionWithoutOverride), "2026-10-15");
  assert.equal(sessionEffectiveTime(sessionWithoutOverride), "10:00");
});
