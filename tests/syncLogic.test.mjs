import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseWorkbookData } from "../src/importExcel.js";

// Helper matching hasStudentChanged from App.jsx
function hasStudentChanged(existing, incoming, newCoordinatorEmail) {
  if (!existing) return true;
  if (
    newCoordinatorEmail &&
    (existing.coordinatorEmail || "").toLowerCase() !== newCoordinatorEmail.toLowerCase()
  ) {
    return true;
  }
  const fields = [
    "name",
    "mobile",
    "email",
    "gender",
    "studentType",
    "moduleName",
    "batch",
  ];
  return fields.some((f) => {
    const incVal = incoming[f];
    if (incVal !== undefined && incVal !== "" && incVal !== "Unknown") {
      return (existing[f] ?? "") !== incVal;
    }
    return false;
  });
}

// Mock helper representing synchronization logic from App.jsx
function simulateSync({
  incomingWorkbook,
  existingGroups = [],
  existingStudents = [],
  existingSessions = [],
  existingCredentials = [],
}) {
  const { groups: importedGroups, students: importedStudents, skippedGroups, invalidRows } =
    parseWorkbookData(incomingWorkbook);

  const existingGroupMap = new Map(existingGroups.map((g) => [g.groupCode, g]));
  const existingStudentsMap = new Map(
    existingStudents.map((s) => [`${s.groupCode}:${s.userId || s.mobile}`, s]),
  );
  const existingSessionIds = new Set(existingSessions.map((s) => s.id));
  const existingCredentialsMap = new Map(
    existingCredentials.map((c) => [c.groupCode, c]),
  );

  const operations = [];
  let createdGroups = 0;
  let updatedGroups = 0;
  let unchangedGroups = 0;
  let createdStudents = 0;
  let updatedStudents = 0;
  let unchangedStudents = 0;
  let newSessions = 0;
  let reassignedSessions = 0;
  let notificationsCreated = 0;

  for (const group of importedGroups) {
    const existingGroup = existingGroupMap.get(group.groupCode);
    const groupId = group.groupCode;

    if (!existingGroup) {
      // Genuinely new group
      operations.push({
        type: "CREATE_GROUP",
        groupCode: group.groupCode,
        assignmentCount: 1,
        data: group,
      });
      createdGroups++;

      // Create 10 sessions
      for (let i = 1; i <= 10; i++) {
        operations.push({
          type: "CREATE_SESSION",
          id: `${group.groupCode}:session:${i}`,
          sessionNumber: i,
        });
        newSessions++;
      }

      // Initial assignment notification with deterministic ID
      if (group.coordinatorEmail) {
        operations.push({
          type: "CREATE_NOTIFICATION",
          id: `notif:${group.groupCode}:assign:1`,
          recipientEmail: group.coordinatorEmail,
          groupCode: group.groupCode,
          assignmentIndex: 1,
          notifType: "assignment",
        });
        notificationsCreated++;
      }

      if (group.zoomUserId || group.zoomPassword) {
        operations.push({
          type: "CREATE_CREDENTIALS",
          groupCode: group.groupCode,
          coordinatorEmail: group.coordinatorEmail,
        });
      }
    } else {
      // Existing group
      const isCoordinatorChanged = Boolean(
        group.coordinatorEmail &&
        existingGroup.coordinatorEmail &&
        existingGroup.coordinatorEmail.toLowerCase() !== group.coordinatorEmail.toLowerCase()
      );

      const isMetadataChanged =
        existingGroup.trackName !== group.trackName ||
        existingGroup.coachName !== group.coachName ||
        isCoordinatorChanged;

      if (isCoordinatorChanged) {
        const nextAssignmentCount = (existingGroup.assignmentCount || 1) + 1;
        operations.push({
          type: "UPDATE_GROUP",
          groupCode: group.groupCode,
          assignmentCount: nextAssignmentCount,
          coordinatorEmail: group.coordinatorEmail,
          data: group,
        });
        updatedGroups++;

        // Deterministic reassignment notification
        operations.push({
          type: "CREATE_NOTIFICATION",
          id: `notif:${group.groupCode}:assign:${nextAssignmentCount}`,
          recipientEmail: group.coordinatorEmail,
          groupCode: group.groupCode,
          assignmentIndex: nextAssignmentCount,
          notifType: "reassignment",
        });
        notificationsCreated++;

        // Synchronize Zoom credentials access for the new coordinator
        if (existingCredentialsMap.has(group.groupCode) || group.zoomUserId || group.zoomPassword) {
          operations.push({
            type: "UPDATE_CREDENTIALS",
            groupCode: group.groupCode,
            coordinatorEmail: group.coordinatorEmail,
          });
        }
      } else if (isMetadataChanged) {
        operations.push({ type: "UPDATE_GROUP", groupCode: group.groupCode, data: group });
        updatedGroups++;
      } else {
        unchangedGroups++;
      }

      // Create ONLY missing sessions for existing group
      for (let i = 1; i <= 10; i++) {
        const sessionId = `${group.groupCode}:session:${i}`;
        if (!existingSessionIds.has(sessionId)) {
          operations.push({
            type: "CREATE_SESSION",
            id: sessionId,
            sessionNumber: i,
          });
          newSessions++;
        }
      }
    }
  }

  // Synchronize sessions for reassigned groups
  for (const session of existingSessions) {
    const incomingGroup = importedGroups.find((g) => g.groupCode === session.groupCode);
    if (
      incomingGroup &&
      incomingGroup.coordinatorEmail &&
      (session.coordinatorEmail || "").toLowerCase() !== incomingGroup.coordinatorEmail.toLowerCase()
    ) {
      operations.push({
        type: "REASSIGN_SESSION",
        id: session.id,
        coordinatorEmail: incomingGroup.coordinatorEmail,
      });
      reassignedSessions++;
    }
  }

  // Selective student updates: avoid updating students when Excel fields haven't changed!
  for (const st of importedStudents) {
    const key = `${st.groupCode}:${st.userId || st.mobile}`;
    const existing = existingStudentsMap.get(key);
    const parentGroup = importedGroups.find((g) => g.groupCode === st.groupCode);
    const coordinatorEmail = parentGroup?.coordinatorEmail || st.coordinatorEmail || "";

    if (!existing) {
      operations.push({
        type: "CREATE_STUDENT",
        key,
        status: "لم يُرسل",
      });
      createdStudents++;
    } else if (hasStudentChanged(existing, st, coordinatorEmail)) {
      // PRESERVE operational status!
      operations.push({
        type: "UPDATE_STUDENT",
        key,
        preservedStatus: existing.status, // NEVER overwritten!
      });
      updatedStudents++;
    } else {
      unchangedStudents++;
    }
  }

  return {
    operations,
    createdGroups,
    updatedGroups,
    unchangedGroups,
    createdStudents,
    updatedStudents,
    unchangedStudents,
    newSessions,
    reassignedSessions,
    notificationsCreated,
    skippedGroups,
    invalidRows,
  };
}

// Mock helper representing generateExistingSessions from App.jsx
function simulateGenerateExistingSessions(groups, existingSessions) {
  const existingSessionIds = new Set(existingSessions.map((s) => s.id));
  const operations = [];

  for (const group of groups) {
    for (let i = 1; i <= 10; i++) {
      const sessionId = `${group.groupCode}:session:${i}`;
      if (!existingSessionIds.has(sessionId)) {
        operations.push({
          type: "CREATE_SESSION",
          id: sessionId,
          groupCode: group.groupCode,
          sessionNumber: i,
        });
      }
    }
  }

  return operations;
}

test("Sync creates genuinely new groups and sends notification", () => {
  const wsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "Coach",
      "Day",
      "Time",
      "Start Date",
    ],
    [
      "NEW-G1",
      "AI Engineering",
      "Sara Smith",
      "sara@coaching.com",
      "Coach John",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const res = simulateSync({
    incomingWorkbook: wb,
    existingGroups: [],
  });

  assert.equal(res.createdGroups, 1);
  assert.equal(res.newSessions, 10);
  assert.equal(res.notificationsCreated, 1);
  const notif = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(notif.id, "notif:NEW-G1:assign:1");
  assert.equal(notif.recipientEmail, "sara@coaching.com");
});

test("Sync does NOT send duplicate notification on repeated import of same group", () => {
  const wsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "Coach",
      "Day",
      "Time",
      "Start Date",
    ],
    [
      "EXISTING-G1",
      "AI Engineering",
      "Sara Smith",
      "sara@coaching.com",
      "Coach John",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const existing = {
    groupCode: "EXISTING-G1",
    trackName: "AI Engineering",
    coordinatorName: "Sara Smith",
    coordinatorEmail: "sara@coaching.com",
    coachName: "Coach John",
    assignmentCount: 1,
  };

  const res = simulateSync({
    incomingWorkbook: wb,
    existingGroups: [existing],
  });

  assert.equal(res.createdGroups, 0);
  assert.equal(res.unchangedGroups, 1);
  assert.equal(res.notificationsCreated, 0); // Idempotent! Zero duplicate notifications
});

test("Sync notifies new coordinator upon group reassignment and updates Zoom credentials", () => {
  const wsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "Coach",
      "Day",
      "Time",
      "Start Date",
    ],
    [
      "REASSIGN-G1",
      "AI Engineering",
      "Mona Khaled",
      "mona@coaching.com", // New coordinator
      "Coach John",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const existing = {
    groupCode: "REASSIGN-G1",
    trackName: "AI Engineering",
    coordinatorName: "Sara Smith",
    coordinatorEmail: "sara@coaching.com", // Old coordinator
    coachName: "Coach John",
    assignmentCount: 1,
  };

  const existingCreds = {
    groupCode: "REASSIGN-G1",
    coordinatorEmail: "sara@coaching.com",
    zoomUserId: "zoom@coach.com",
  };

  const res = simulateSync({
    incomingWorkbook: wb,
    existingGroups: [existing],
    existingCredentials: [existingCreds],
  });

  assert.equal(res.updatedGroups, 1);
  assert.equal(res.notificationsCreated, 1);
  const notif = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(notif.recipientEmail, "mona@coaching.com");
  assert.equal(notif.notifType, "reassignment");
  assert.equal(notif.assignmentIndex, 2);
  assert.equal(notif.id, "notif:REASSIGN-G1:assign:2");

  // Zoom credentials synchronized to new coordinator
  const credOp = res.operations.find((op) => op.type === "UPDATE_CREDENTIALS");
  assert.ok(credOp);
  assert.equal(credOp.coordinatorEmail, "mona@coaching.com");
});

test("Sync supports genuine later reassignment BACK to previous coordinator", () => {
  const wsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "Coach",
      "Day",
      "Time",
      "Start Date",
    ],
    [
      "REASSIGN-BACK-G1",
      "Web Development",
      "Sara Smith",
      "sara@coaching.com", // Reassigned BACK to Sara (who was initial coordinator)
      "Coach John",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // Currently assigned to Mona, assignmentCount: 2
  const existing = {
    groupCode: "REASSIGN-BACK-G1",
    trackName: "Web Development",
    coordinatorName: "Mona Khaled",
    coordinatorEmail: "mona@coaching.com",
    assignmentCount: 2,
  };

  const res = simulateSync({
    incomingWorkbook: wb,
    existingGroups: [existing],
  });

  assert.equal(res.updatedGroups, 1);
  assert.equal(res.notificationsCreated, 1);
  const notif = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(notif.recipientEmail, "sara@coaching.com");
  assert.equal(notif.assignmentIndex, 3);
  assert.equal(notif.id, "notif:REASSIGN-BACK-G1:assign:3");
});

test("Sync avoids updating existing students when their Excel-owned fields have not changed", () => {
  const wsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "English Name",
      "Mobile",
      "User ID",
      "Start Date",
    ],
    // Student 1: identical to database
    [
      "GRP-UNCHANGED",
      "Web",
      "Coordinator A",
      "coord@a.com",
      "Student Unchanged",
      "01011111111",
      "UID-001",
      "2025-04-01",
    ],
    // Student 2: mobile number changed in Excel
    [
      "GRP-UNCHANGED",
      "Web",
      "Coordinator A",
      "coord@a.com",
      "Student Changed",
      "01022222222",
      "UID-002",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const existingStudents = [
    {
      groupCode: "GRP-UNCHANGED",
      userId: "UID-001",
      mobile: "01011111111",
      name: "Student Unchanged",
      coordinatorEmail: "coord@a.com",
      status: "دخل الجروب", // Preserved!
    },
    {
      groupCode: "GRP-UNCHANGED",
      userId: "UID-002",
      mobile: "01000000000", // Old mobile
      name: "Student Changed",
      coordinatorEmail: "coord@a.com",
      status: "تم التواصل", // Preserved!
    },
  ];

  const res = simulateSync({
    incomingWorkbook: wb,
    existingGroups: [
      {
        groupCode: "GRP-UNCHANGED",
        coordinatorEmail: "coord@a.com",
      },
    ],
    existingStudents,
  });

  // Student 1 had no changes -> NOT queued for update!
  assert.equal(res.unchangedStudents, 1);
  // Student 2 had changed mobile -> queued for update while preserving status!
  assert.equal(res.updatedStudents, 1);
  const updateOp = res.operations.find((op) => op.type === "UPDATE_STUDENT");
  assert.equal(updateOp.preservedStatus, "تم التواصل");
});

test("Generate / Sync Group Sessions only creates missing sessions and NEVER overwrites existing ones", () => {
  const groups = [
    {
      groupCode: "GRP-SESSION-TEST",
      startDate: "2025-04-01",
      time: "7:00 PM",
      coordinatorEmail: "coord@test.com",
      coordinatorName: "Coordinator Test",
    },
  ];

  // Suppose sessions 1, 2, 3 already exist in Firestore with custom overrides and recorded attendance
  const existingSessions = [
    {
      id: "GRP-SESSION-TEST:session:1",
      groupCode: "GRP-SESSION-TEST",
      sessionNumber: 1,
      scheduledDate: "2025-04-01",
      overrideDate: "2025-04-03", // Coordinator rescheduled
      overrideTime: "8:00 PM",
      status: "Completed",
      attendanceCount: 15,
      notes: "All attended actively.",
    },
    {
      id: "GRP-SESSION-TEST:session:2",
      groupCode: "GRP-SESSION-TEST",
      sessionNumber: 2,
      scheduledDate: "2025-04-08",
      status: "In progress",
      attendanceCount: 12,
    },
    {
      id: "GRP-SESSION-TEST:session:3",
      groupCode: "GRP-SESSION-TEST",
      sessionNumber: 3,
      scheduledDate: "2025-04-15",
      status: "Scheduled",
    },
  ];

  const ops = simulateGenerateExistingSessions(groups, existingSessions);

  // Exactly 7 missing sessions (4 through 10) must be created
  assert.equal(ops.length, 7);
  assert.equal(ops[0].sessionNumber, 4);
  assert.equal(ops[6].sessionNumber, 10);

  // Sessions 1, 2, and 3 are NOT in operations (they are never overwritten!)
  assert.equal(ops.some((op) => op.sessionNumber === 1), false);
  assert.equal(ops.some((op) => op.sessionNumber === 2), false);
  assert.equal(ops.some((op) => op.sessionNumber === 3), false);
});
