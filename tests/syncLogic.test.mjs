import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseWorkbookData } from "../src/importExcel.js";
import {
  documentId,
  hasExcelMetadataChanged,
  hasStudentChanged,
  reconcileWorkbook,
  resolveCoordinatorIdentity,
  generateMissingSessions,
} from "../src/syncLogic.js";

const mockRegisteredUsers = [
  {
    id: "uid-bahaa",
    email: "bahaa@coaching.com",
    name: "Bahaa Shaheen",
    role: "coordinator",
  },
  {
    id: "uid-amani",
    email: "amani@coaching.com",
    name: "Amani Mohamed",
    role: "coordinator",
  },
];

// Helper to simulate sync from workbook using shared reconcileWorkbook
function runSync({
  incomingWorkbook,
  existingGroups = [],
  existingStudents = [],
  existingSessions = [],
  existingNotifications = [],
  existingCredentials = [],
  existingUsers = mockRegisteredUsers,
}) {
  const { groups, students, skippedGroups, invalidRows } =
    parseWorkbookData(incomingWorkbook);

  const syncResult = reconcileWorkbook({
    importedGroups: groups,
    importedStudents: students,
    existingGroups,
    existingStudents,
    existingSessions,
    existingUsers,
    existingNotifications,
    existingCredentials,
    timestampProvider: () => new Date("2026-10-28T12:00:00Z"),
  });

  return {
    ...syncResult,
    parsedSkippedGroups: skippedGroups,
    parsedInvalidRows: invalidRows,
    allSkippedGroups: [...skippedGroups, ...syncResult.skippedGroups],
    allInvalidRows: [...invalidRows, ...syncResult.invalidRows],
  };
}

// ============================================================================
// 1. New group assigned from Old Students
// ============================================================================
test("1. New group assigned from Old Students triggers assignment notification and creates sessions", () => {
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
      "OLD-NEW-G1",
      "Cloud Architecture",
      "Bahaa Shaheen",
      "bahaa@coaching.com",
      "Coach Tamer",
      "Sunday",
      "6:00 PM",
      "2025-05-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const res = runSync({ incomingWorkbook: wb });

  assert.equal(res.createdGroups, 1);
  assert.equal(res.newSessions, 10);
  assert.equal(res.notificationsCreated, 1);

  const notif = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.ok(notif);
  assert.equal(notif.recipientEmail, "bahaa@coaching.com");
  assert.equal(notif.groupCode, "OLD-NEW-G1");
  assert.equal(notif.assignmentIndex, 1);
  assert.equal(notif.notifType, "assignment");
  assert.equal(notif.data.active, true);
  assert.equal(notif.data.superseded, false);
});

// ============================================================================
// 2. New group assigned from New Students
// ============================================================================
test("2. New group assigned from New Students triggers assignment notification and creates sessions", () => {
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
      "NEW-STUDENTS-G1",
      "Fullstack Web",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Hazem",
      "Monday",
      "7:00 PM",
      "2025-05-05",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const res = runSync({ incomingWorkbook: wb });

  assert.equal(res.createdGroups, 1);
  assert.equal(res.newSessions, 10);
  assert.equal(res.notificationsCreated, 1);

  const notif = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.ok(notif);
  assert.equal(notif.recipientEmail, "amani@coaching.com");
  assert.equal(notif.groupCode, "NEW-STUDENTS-G1");
  assert.equal(notif.assignmentIndex, 1);
  assert.equal(notif.notifType, "assignment");
});

// ============================================================================
// 3. First assignment of an existing Old group
// ============================================================================
test("3. First assignment of an existing unassigned Old group detects change and sends notification", () => {
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
      "EXISTING-OLD-UNASSIGNED",
      "Data Analytics",
      "Bahaa Shaheen",
      "bahaa@coaching.com",
      "Coach Ali",
      "Wednesday",
      "8:00 PM",
      "2025-05-10",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "EXISTING-OLD-UNASSIGNED",
    groupCode: "EXISTING-OLD-UNASSIGNED",
    trackName: "Data Analytics",
    coordinatorEmail: "", // Previously unassigned!
    coordinatorName: "",
    assignmentCount: 0,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
  });

  assert.equal(res.createdGroups, 0);
  assert.equal(res.updatedGroups, 1);
  assert.equal(res.notificationsCreated, 1);

  const groupOp = res.operations.find((op) => op.type === "UPDATE_GROUP");
  assert.equal(groupOp.coordinatorEmail, "bahaa@coaching.com");
  assert.equal(groupOp.assignmentCount, 1);

  const notifOp = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.ok(notifOp);
  assert.equal(notifOp.recipientEmail, "bahaa@coaching.com");
  assert.equal(notifOp.assignmentIndex, 1);
});

// ============================================================================
// 4. First assignment of an existing New group
// ============================================================================
test("4. First assignment of an existing unassigned New group detects change and sends notification", () => {
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
      "EXISTING-NEW-UNASSIGNED",
      "Cybersecurity",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Samy",
      "Thursday",
      "6:00 PM",
      "2025-05-15",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const existingGroup = {
    id: "EXISTING-NEW-UNASSIGNED",
    groupCode: "EXISTING-NEW-UNASSIGNED",
    trackName: "Cybersecurity",
    coordinatorEmail: "",
    coordinatorName: "",
    assignmentCount: 0,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
  });

  assert.equal(res.createdGroups, 0);
  assert.equal(res.updatedGroups, 1);
  assert.equal(res.notificationsCreated, 1);

  const notifOp = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(notifOp.recipientEmail, "amani@coaching.com");
  assert.equal(notifOp.assignmentIndex, 1);
});

// ============================================================================
// 5. Reassignment from Bahaa to Amani in Old Students
// ============================================================================
test("5. Reassignment from Bahaa to Amani in Old Students updates group, supersedes Bahaa's notification, and notifies Amani", () => {
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
      "GROUP-X",
      "AI Engineering",
      "Amani Mohamed",
      "amani@coaching.com", // Reassigned to Amani!
      "Coach John",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GROUP-X",
    groupCode: "GROUP-X",
    trackName: "AI Engineering",
    coordinatorName: "Bahaa Shaheen",
    coordinatorEmail: "bahaa@coaching.com",
    assignmentCount: 1,
  };

  const existingNotification = {
    id: "notif:GROUP-X:assign:1",
    groupCode: "GROUP-X",
    recipientEmail: "bahaa@coaching.com",
    assignmentIndex: 1,
    active: true,
    superseded: false,
    read: true,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingNotifications: [existingNotification],
  });

  assert.equal(res.updatedGroups, 1);
  assert.equal(res.notificationsCreated, 1);
  assert.equal(res.notificationsSuperseded, 1);

  // Group updated
  const groupOp = res.operations.find((op) => op.type === "UPDATE_GROUP");
  assert.equal(groupOp.coordinatorEmail, "amani@coaching.com");
  assert.equal(groupOp.assignmentCount, 2);

  // Bahaa's notification superseded
  const supersedeOp = res.operations.find((op) => op.type === "UPDATE_NOTIFICATION");
  assert.ok(supersedeOp);
  assert.equal(supersedeOp.id, "notif:GROUP-X:assign:1");
  assert.equal(supersedeOp.data.superseded, true);
  assert.equal(supersedeOp.data.active, false);
  assert.equal(supersedeOp.data.supersededByCoordinatorEmail, "amani@coaching.com");
  assert.equal(supersedeOp.data.supersededByAssignmentIndex, 2);

  // Amani's new notification created
  const newNotifOp = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.ok(newNotifOp);
  assert.equal(newNotifOp.recipientEmail, "amani@coaching.com");
  assert.equal(newNotifOp.assignmentIndex, 2);
  assert.equal(newNotifOp.notifType, "reassignment");
  assert.equal(newNotifOp.data.active, true);
  assert.equal(newNotifOp.data.superseded, false);
});

// ============================================================================
// 6. Reassignment from Bahaa to Amani in New Students
// ============================================================================
test("6. Reassignment from Bahaa to Amani in New Students behaves identically to Old Students", () => {
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
      "GROUP-Y",
      "Web Dev",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Sarah",
      "Tuesday",
      "5:00 PM",
      "2025-04-10",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const existingGroup = {
    id: "GROUP-Y",
    groupCode: "GROUP-Y",
    coordinatorName: "Bahaa Shaheen",
    coordinatorEmail: "bahaa@coaching.com",
    assignmentCount: 1,
  };

  const existingNotification = {
    id: "notif:GROUP-Y:assign:1",
    groupCode: "GROUP-Y",
    recipientEmail: "bahaa@coaching.com",
    assignmentIndex: 1,
    active: true,
    superseded: false,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingNotifications: [existingNotification],
  });

  assert.equal(res.updatedGroups, 1);
  assert.equal(res.notificationsCreated, 1);
  assert.equal(res.notificationsSuperseded, 1);

  const groupOp = res.operations.find((op) => op.type === "UPDATE_GROUP");
  assert.equal(groupOp.coordinatorEmail, "amani@coaching.com");
  assert.equal(groupOp.assignmentCount, 2);
});

// ============================================================================
// 7. Previous coordinator loses access to the reassigned group
// ============================================================================
test("7. Previous coordinator loses access to the reassigned group across groups, sessions, students, and credentials", () => {
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
      "GRP-ACCESS-TEST",
      "Mobile Dev",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Mona",
      "Sunday",
      "6:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GRP-ACCESS-TEST",
    groupCode: "GRP-ACCESS-TEST",
    coordinatorEmail: "bahaa@coaching.com",
    assignmentCount: 1,
  };

  const existingSessions = [
    {
      id: "GRP-ACCESS-TEST:session:1",
      groupCode: "GRP-ACCESS-TEST",
      sessionNumber: 1,
      coordinatorEmail: "bahaa@coaching.com",
    },
  ];

  const existingStudents = [
    {
      id: "stu-1",
      groupCode: "GRP-ACCESS-TEST",
      userId: "U1",
      name: "Ahmed",
      coordinatorEmail: "bahaa@coaching.com",
      status: "دخل الجروب",
    },
  ];

  const existingCredentials = [
    {
      id: "GRP-ACCESS-TEST",
      groupCode: "GRP-ACCESS-TEST",
      coordinatorEmail: "bahaa@coaching.com",
      zoomUserId: "zoom@coach.com",
    },
  ];

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingSessions,
    existingStudents,
    existingCredentials,
  });

  // 1. Group coordinatorEmail updated to Amani
  const groupOp = res.operations.find((op) => op.type === "UPDATE_GROUP");
  assert.equal(groupOp.data.coordinatorEmail, "amani@coaching.com");

  // 2. Session coordinatorEmail updated to Amani
  const sessOp = res.operations.find((op) => op.type === "REASSIGN_SESSION");
  assert.equal(sessOp.data.coordinatorEmail, "amani@coaching.com");

  // 3. Student coordinatorEmail updated to Amani
  const stuOp = res.operations.find((op) => op.type === "UPDATE_STUDENT");
  assert.equal(stuOp.data.coordinatorEmail, "amani@coaching.com");

  // 4. Zoom credentials updated to Amani
  const credOp = res.operations.find((op) => op.type === "UPDATE_CREDENTIALS");
  assert.equal(credOp.data.coordinatorEmail, "amani@coaching.com");
});

// ============================================================================
// 8. New coordinator receives exactly one notification
// ============================================================================
test("8. New coordinator receives exactly one notification upon reassignment", () => {
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
      "GRP-EXACTLY-ONE",
      "DevOps",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Fady",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const existingGroup = {
    id: "GRP-EXACTLY-ONE",
    groupCode: "GRP-EXACTLY-ONE",
    coordinatorEmail: "bahaa@coaching.com",
    assignmentCount: 1,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
  });

  const createNotifOps = res.operations.filter((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(createNotifOps.length, 1);
  assert.equal(createNotifOps[0].recipientEmail, "amani@coaching.com");
  assert.equal(res.notificationsCreated, 1);
});

// ============================================================================
// 9. Previous active assignment notification becomes superseded
// ============================================================================
test("9. Previous active assignment notification becomes superseded upon reassignment", () => {
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
      "GRP-SUPERSEDE-CHECK",
      "Data Science",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Tamer",
      "Friday",
      "4:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GRP-SUPERSEDE-CHECK",
    groupCode: "GRP-SUPERSEDE-CHECK",
    coordinatorEmail: "bahaa@coaching.com",
    assignmentCount: 1,
  };

  const existingNotif = {
    id: "notif:GRP-SUPERSEDE-CHECK:assign:1",
    groupCode: "GRP-SUPERSEDE-CHECK",
    recipientEmail: "bahaa@coaching.com",
    assignmentIndex: 1,
    active: true,
    superseded: false,
    read: false,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingNotifications: [existingNotif],
  });

  const updateNotifOp = res.operations.find((op) => op.type === "UPDATE_NOTIFICATION");
  assert.ok(updateNotifOp);
  assert.equal(updateNotifOp.id, "notif:GRP-SUPERSEDE-CHECK:assign:1");
  assert.equal(updateNotifOp.data.superseded, true);
  assert.equal(updateNotifOp.data.active, false);
  assert.equal(updateNotifOp.data.status, "superseded");
  assert.equal(updateNotifOp.data.supersededByCoordinatorEmail, "amani@coaching.com");
  assert.equal(updateNotifOp.data.supersededByAssignmentIndex, 2);
  assert.equal(res.notificationsSuperseded, 1);
});

// ============================================================================
// 10. Reimporting unchanged Excel creates zero additional notifications
// ============================================================================
test("10. Reimporting unchanged Excel creates zero additional notifications and preserves read state", () => {
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
      "GRP-IDEMPOTENT-1",
      "UI/UX Design",
      "Bahaa Shaheen",
      "bahaa@coaching.com",
      "Coach Nour",
      "Sunday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GRP-IDEMPOTENT-1",
    groupCode: "GRP-IDEMPOTENT-1",
    trackName: "UI/UX Design",
    coordinatorName: "Bahaa Shaheen",
    coordinatorEmail: "bahaa@coaching.com",
    coachName: "Coach Nour",
    day: "Sunday",
    time: "7:00 PM",
    startDate: "2025-04-01",
    assignmentCount: 1,
  };

  const existingNotif = {
    id: "notif:GRP-IDEMPOTENT-1:assign:1",
    groupCode: "GRP-IDEMPOTENT-1",
    recipientEmail: "bahaa@coaching.com",
    assignmentIndex: 1,
    active: true,
    superseded: false,
    read: true, // Marked as read by coordinator
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingNotifications: [existingNotif],
  });

  assert.equal(res.createdGroups, 0);
  assert.equal(res.updatedGroups, 0);
  assert.equal(res.unchangedGroups, 1);
  assert.equal(res.notificationsCreated, 0);
  assert.equal(res.notificationsSuperseded, 0);

  const notifOps = res.operations.filter(
    (op) => op.type === "CREATE_NOTIFICATION" || op.type === "UPDATE_NOTIFICATION",
  );
  assert.equal(notifOps.length, 0);
});

// ============================================================================
// 11. Existing session statuses and notes remain unchanged
// ============================================================================
test("11. Existing session statuses, attendance counts, notes, and rescheduled dates remain unchanged upon reassignment", () => {
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
      "GRP-SESSION-PRESERVE",
      "Web",
      "Amani Mohamed",
      "amani@coaching.com",
      "Coach Karim",
      "Tuesday",
      "8:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GRP-SESSION-PRESERVE",
    groupCode: "GRP-SESSION-PRESERVE",
    coordinatorEmail: "bahaa@coaching.com",
    assignmentCount: 1,
  };

  const existingSessions = [
    {
      id: "GRP-SESSION-PRESERVE:session:1",
      groupCode: "GRP-SESSION-PRESERVE",
      sessionNumber: 1,
      scheduledDate: "2025-04-01",
      overrideDate: "2025-04-03", // Custom rescheduled date
      overrideTime: "9:00 PM",
      status: "Completed",
      attendanceCount: 18,
      notes: "Critical feedback discussed in detail.",
      coordinatorEmail: "bahaa@coaching.com",
    },
  ];

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingSessions,
  });

  // Find reassignment op for session 1
  const sessOp = res.operations.find(
    (op) => op.type === "REASSIGN_SESSION" && op.id === "GRP-SESSION-PRESERVE:session:1",
  );
  assert.ok(sessOp);
  // Only coordinatorEmail and coordinatorName are modified
  assert.equal(sessOp.data.coordinatorEmail, "amani@coaching.com");
  assert.equal(sessOp.data.status, undefined);
  assert.equal(sessOp.data.attendanceCount, undefined);
  assert.equal(sessOp.data.notes, undefined);
  assert.equal(sessOp.data.overrideDate, undefined);
  assert.equal(sessOp.data.overrideTime, undefined);
});

// ============================================================================
// 12. Invalid coordinator identities are handled safely
// ============================================================================
test("12. Invalid coordinator identities report validation error and do not corrupt existing assignment", () => {
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
    // Group with invalid/unregistered coordinator name and invalid email
    [
      "GRP-INVALID-COORD",
      "AI",
      "Unregistered Ghost Coordinator",
      "",
      "Coach Mike",
      "Monday",
      "7:00 PM",
      "2025-04-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GRP-INVALID-COORD",
    groupCode: "GRP-INVALID-COORD",
    coordinatorEmail: "bahaa@coaching.com", // Existing valid coordinator
    coordinatorName: "Bahaa Shaheen",
    assignmentCount: 1,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
    existingUsers: mockRegisteredUsers,
  });

  // Must report validation error in invalidRows
  assert.equal(res.allInvalidRows.length, 1);
  assert.equal(res.allInvalidRows[0].groupCode, "GRP-INVALID-COORD");
  assert.match(res.allInvalidRows[0].reason, /Unknown coordinator/);

  // Group must NOT be updated or corrupted!
  assert.equal(res.updatedGroups, 0);
  assert.equal(res.createdGroups, 0);
  assert.equal(res.notificationsCreated, 0);

  const groupUpdateOps = res.operations.filter((op) => op.type === "UPDATE_GROUP");
  assert.equal(groupUpdateOps.length, 0);
});

// ============================================================================
// 13. Both worksheets containing overlapping group identifiers do not create accidental duplicates
// ============================================================================
test("13. Both worksheets containing overlapping group identifiers do not create accidental duplicates", () => {
  const oldWsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "Coach",
      "Day",
      "Time",
      "Start Date",
      "English Name",
      "Mobile",
      "User ID",
    ],
    // Group OVERLAP-G1 in Old Students worksheet with student 1
    [
      "OVERLAP-G1",
      "Software Testing",
      "Bahaa Shaheen",
      "bahaa@coaching.com",
      "Coach Yasser",
      "Thursday",
      "6:00 PM",
      "2025-04-15",
      "Old Student A",
      "01011111111",
      "STU-OLD-1",
    ],
  ];

  const newWsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator",
      "Group Coordinator Email",
      "Coach",
      "Day",
      "Time",
      "Start Date",
      "English Name",
      "Mobile",
      "User ID",
    ],
    // Same Group OVERLAP-G1 in New Students worksheet with student 2
    [
      "OVERLAP-G1",
      "Software Testing",
      "Bahaa Shaheen",
      "bahaa@coaching.com",
      "Coach Yasser",
      "Thursday",
      "6:00 PM",
      "2025-04-15",
      "New Student B",
      "01022222222",
      "STU-NEW-2",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const wsOld = XLSX.utils.aoa_to_sheet(oldWsData);
  const wsNew = XLSX.utils.aoa_to_sheet(newWsData);
  XLSX.utils.book_append_sheet(wb, wsOld, "Old Students Coashing");
  XLSX.utils.book_append_sheet(wb, wsNew, "New Students Coashing");

  const parsed = parseWorkbookData(wb);
  // Parsed workbook must contain exactly 1 merged group and both students
  assert.equal(parsed.groups.length, 1);
  assert.equal(parsed.groups[0].groupCode, "OVERLAP-G1");
  assert.equal(parsed.students.length, 2);

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [],
  });

  // Exactly 1 group created, exactly 1 notification, 2 students created
  assert.equal(res.createdGroups, 1);
  assert.equal(res.notificationsCreated, 1);
  assert.equal(res.createdStudents, 2);

  const groupCreateOps = res.operations.filter((op) => op.type === "CREATE_GROUP");
  assert.equal(groupCreateOps.length, 1);

  const notifCreateOps = res.operations.filter((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(notifCreateOps.length, 1);
  assert.equal(notifCreateOps[0].recipientEmail, "bahaa@coaching.com");
});

// ============================================================================
// Additional edge cases: Unassigned group policy & Coordinator name matching
// ============================================================================
test("Coordinator resolved by name when email column is omitted (e.g. in Old Students)", () => {
  const wsData = [
    [
      "Group Code",
      "Track Name",
      "Group Coordinator", // Only coordinator name column, NO email column
      "Coach",
      "Day",
      "Time",
      "Start Date",
    ],
    [
      "GRP-NAME-RESOLVE",
      "Web",
      "Bahaa Shaheen",
      "Coach Amr",
      "Monday",
      "6:00 PM",
      "2025-05-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const res = runSync({ incomingWorkbook: wb, existingUsers: mockRegisteredUsers });

  assert.equal(res.createdGroups, 1);
  assert.equal(res.notificationsCreated, 1);
  const notif = res.operations.find((op) => op.type === "CREATE_NOTIFICATION");
  assert.equal(notif.recipientEmail, "bahaa@coaching.com");
});

test("Unassigned incoming group is skipped per documented policy and does not overwrite existing assignment", () => {
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
      "GRP-UNASSIGNED-POLICY",
      "Web",
      "", // Empty coordinator
      "",
      "Coach Amr",
      "Monday",
      "6:00 PM",
      "2025-05-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const existingGroup = {
    id: "GRP-UNASSIGNED-POLICY",
    groupCode: "GRP-UNASSIGNED-POLICY",
    coordinatorEmail: "bahaa@coaching.com",
    coordinatorName: "Bahaa Shaheen",
    assignmentCount: 1,
  };

  const res = runSync({
    incomingWorkbook: wb,
    existingGroups: [existingGroup],
  });

  assert.equal(res.allSkippedGroups.length, 1);
  assert.equal(res.allSkippedGroups[0].groupCode, "GRP-UNASSIGNED-POLICY");
  assert.equal(res.updatedGroups, 0);
  assert.equal(res.createdGroups, 0);
  assert.equal(res.notificationsCreated, 0);
});
