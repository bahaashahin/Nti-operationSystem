import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  normalizeDate,
  tryParseDate,
  addWeeks,
  cairoToday,
  dateLabel,
  formatPhone,
  parseWorkbookData,
} from "../src/importExcel.js";

test("normalizeDate parses valid ISO date string", () => {
  assert.equal(normalizeDate("2025-03-01"), "2025-03-01");
  assert.equal(normalizeDate("2025-12-25"), "2025-12-25");
});

test("normalizeDate parses slash format DD/MM/YYYY and YYYY/MM/DD", () => {
  assert.equal(normalizeDate("05/03/2025"), "2025-03-05");
  assert.equal(normalizeDate("2025/03/05"), "2025-03-05");
  assert.equal(normalizeDate("15-04-2025"), "2025-04-15");
});

test("normalizeDate parses Excel serial numbers correctly", () => {
  // 45717 is 2025-03-01 in Excel date system
  const dateKey = normalizeDate(45717);
  assert.equal(dateKey, "2025-03-01");
});

test("normalizeDate parses text dates with weekday names", () => {
  assert.equal(normalizeDate("Saturday, 15 Feb 2025"), "2025-02-15");
  assert.equal(normalizeDate("Monday 10 March 2025"), "2025-03-10");
});

test("normalizeDate REJECTS priority values and throws descriptive error", () => {
  assert.throws(() => normalizeDate("HIGH"), /Cannot read date "HIGH"/);
  assert.throws(() => normalizeDate("MEDIUM"), /Cannot read date "MEDIUM"/);
  assert.throws(() => normalizeDate("LOW"), /Cannot read date "LOW"/);
  assert.throws(() => normalizeDate("urgent"), /Cannot read date/);
});

test("normalizeDate REJECTS status text and non-dates", () => {
  assert.throws(() => normalizeDate("Active"), /Cannot read date/);
  assert.throws(() => normalizeDate("Scheduled"), /Cannot read date/);
  assert.throws(() => normalizeDate("Cancelled"), /Cannot read date/);
  assert.throws(() => normalizeDate("Random Non Date"), /Cannot read date/);
});

test("normalizeDate handles unknown or empty input gracefully", () => {
  assert.equal(normalizeDate(""), "Unknown");
  assert.equal(normalizeDate(null), "Unknown");
  assert.equal(normalizeDate(undefined), "Unknown");
  assert.equal(normalizeDate("Unknown"), "Unknown");
  assert.equal(normalizeDate("   "), "Unknown");
});

test("addWeeks adds weeks accurately in UTC", () => {
  assert.equal(addWeeks("2025-03-01", 1), "2025-03-08");
  assert.equal(addWeeks("2025-03-01", 4), "2025-03-29");
  assert.equal(addWeeks("2025-03-01", 5), "2025-04-05");
});

test("cairoToday returns YYYY-MM-DD format", () => {
  const today = cairoToday();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

test("formatPhone formats Egyptian phone numbers correctly", () => {
  assert.equal(formatPhone("01012345678"), "201012345678");
  assert.equal(formatPhone("00201012345678"), "201012345678");
  assert.equal(formatPhone("+201012345678"), "201012345678");
});

test("parseWorkbookData imports assigned groups and skips unassigned groups", () => {
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
      "English Name",
      "Mobile",
    ],
    // Group 1: Assigned coordinator
    [
      "GRP-ASSIGNED-1",
      "Web Dev",
      "Mona Ahmed",
      "mona@example.com",
      "Coach Hazem",
      "Sunday",
      "7:00 PM",
      "2025-03-01",
      "Student One",
      "01011111111",
    ],
    // Group 2: Empty coordinator (should be skipped)
    [
      "GRP-UNASSIGNED-1",
      "Web Dev",
      "",
      "",
      "Coach Karim",
      "Monday",
      "8:00 PM",
      "2025-03-02",
      "Student Two",
      "01022222222",
    ],
    // Group 3: Whitespace coordinator (should be skipped)
    [
      "GRP-UNASSIGNED-2",
      "Data Analytics",
      "   ",
      "",
      "Coach Karim",
      "Tuesday",
      "8:00 PM",
      "2025-03-03",
      "Student Three",
      "01033333333",
    ],
    // Group 4: "Unknown" coordinator (should be skipped)
    [
      "GRP-UNASSIGNED-3",
      "UI/UX",
      "Unknown",
      "",
      "Coach Karim",
      "Wednesday",
      "8:00 PM",
      "2025-03-04",
      "Student Four",
      "01044444444",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const result = parseWorkbookData(wb);

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].groupCode, "GRP-ASSIGNED-1");
  assert.equal(result.groups[0].coordinatorName, "Mona Ahmed");
  assert.equal(result.skippedGroups.length, 3);
  assert.equal(result.skippedGroups[0].groupCode, "GRP-UNASSIGNED-1");
  assert.equal(result.skippedGroups[1].groupCode, "GRP-UNASSIGNED-2");
  assert.equal(result.skippedGroups[2].groupCode, "GRP-UNASSIGNED-3");
});

test("parseWorkbookData handles multi-row group where coordinator is on first row only", () => {
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
      "English Name",
      "Mobile",
      "User ID",
    ],
    // Row 1: Header row for group GRP-MULTI with coordinator
    [
      "GRP-MULTI",
      "Mobile App",
      "Sara Omar",
      "sara@example.com",
      "Coach Tarek",
      "Saturday",
      "6:00 PM",
      "2025-03-15",
      "Student First",
      "01055555555",
      "STU-001",
    ],
    // Row 2: Secondary student row (coordinator empty, groupCode repeated)
    [
      "GRP-MULTI",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Student Second",
      "01066666666",
      "STU-002",
    ],
    // Row 3: Third student row (coordinator empty, groupCode omitted)
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Student Third",
      "01077777777",
      "STU-003",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const result = parseWorkbookData(wb);

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].groupCode, "GRP-MULTI");
  assert.equal(result.groups[0].coordinatorName, "Sara Omar");
  assert.equal(result.students.length, 3);
  assert.equal(result.students[0].name, "Student First");
  assert.equal(result.students[1].name, "Student Second");
  assert.equal(result.students[2].name, "Student Third");
  assert.equal(result.students[1].coordinatorEmail, "sara@example.com");
  assert.equal(result.students[2].coordinatorEmail, "sara@example.com");
});

test("parseWorkbookData handles date parsing bug 'HIGH' without stopping valid groups", () => {
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
      "Priority",
    ],
    // Group 1: Valid date
    [
      "Q9-B1-DA-27-G1",
      "Data Analytics",
      "Amr Khaled",
      "amr@example.com",
      "Coach Ali",
      "Sunday",
      "7:00 PM",
      "2025-04-01",
      "NORMAL",
    ],
    // Group 2 (row 37 equivalent): Start date has "HIGH" (Priority entered in date column with no other date)
    [
      "Q9-B1-DA-27-G5",
      "Data Analytics",
      "Amr Khaled",
      "amr@example.com",
      "Coach Ali",
      "Sunday",
      "7:00 PM",
      "HIGH",
      "HIGH",
    ],
    // Group 3: Another valid group that MUST be processed despite Group 2 having an invalid date
    [
      "Q9-B1-DA-27-G6",
      "Data Analytics",
      "Amr Khaled",
      "amr@example.com",
      "Coach Ali",
      "Sunday",
      "7:00 PM",
      "2025-04-15",
      "LOW",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Old Students Coashing");

  const result = parseWorkbookData(wb);

  // Groups 1 and 3 succeed!
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups[0].groupCode, "Q9-B1-DA-27-G1");
  assert.equal(result.groups[1].groupCode, "Q9-B1-DA-27-G6");

  // Group 2 is recorded in invalidRows with reason and row number
  assert.equal(result.invalidRows.length, 1);
  assert.equal(result.invalidRows[0].groupCode, "Q9-B1-DA-27-G5");
  assert.match(result.invalidRows[0].reason, /Cannot read date "HIGH"/);
});

test("parseWorkbookData strictly validates Start Date column without guessing or searching arbitrary cells", () => {
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
      "Priority",
    ],
    // Start date column has "HIGH", while Priority column happens to have "2025-05-01"
    // System must NOT guess or search arbitrary cells. It must report Group 1 as invalid and skip it independently.
    [
      "Q9-B1-DA-27-INVALID-DATE",
      "Data Analytics",
      "Amr Khaled",
      "amr@example.com",
      "Coach Ali",
      "Sunday",
      "7:00 PM",
      "HIGH",
      "2025-05-01",
    ],
    // Group 2 is valid and must succeed
    [
      "Q9-B1-DA-27-VALID",
      "Data Analytics",
      "Amr Khaled",
      "amr@example.com",
      "Coach Ali",
      "Sunday",
      "7:00 PM",
      "2025-05-15",
      "NORMAL",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "New Students Coashing");

  const result = parseWorkbookData(wb);

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].groupCode, "Q9-B1-DA-27-VALID");
  assert.equal(result.groups[0].startDate, "2025-05-15");
  assert.equal(result.invalidRows.length, 1);
  assert.equal(result.invalidRows[0].groupCode, "Q9-B1-DA-27-INVALID-DATE");
  assert.match(result.invalidRows[0].reason, /Cannot read date "HIGH"/);
});

test("parseWorkbookData handles missing or unknown start dates safely without import-wide failure", () => {
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
    // Group with missing start date
    [
      "GRP-NO-DATE",
      "UI/UX Design",
      "Hala Taha",
      "hala@example.com",
      "Coach Nour",
      "Monday",
      "6:00 PM",
      "",
    ],
    // Group with valid date
    [
      "GRP-WITH-DATE",
      "UI/UX Design",
      "Hala Taha",
      "hala@example.com",
      "Coach Nour",
      "Monday",
      "6:00 PM",
      "2025-06-01",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");

  const result = parseWorkbookData(wb);

  assert.equal(result.groups.length, 2);
  assert.equal(result.groups[0].groupCode, "GRP-NO-DATE");
  assert.equal(result.groups[0].startDate, "Unknown");
  assert.equal(result.groups[1].groupCode, "GRP-WITH-DATE");
  assert.equal(result.groups[1].startDate, "2025-06-01");
  assert.equal(result.invalidRows.length, 0);
});

test("parseWorkbookData supports Arabic column headers", () => {
  const wsData = [
    [
      "كود الجروب",
      "المسار",
      "منسق الجروب",
      "ايميل المنسق",
      "المدرب",
      "اليوم",
      "الموعد",
      "تاريخ البدء",
    ],
    [
      "GRP-ARABIC-1",
      "تطوير الويب",
      "محمود حسن",
      "mahmoud@example.com",
      "كوتش أحمد",
      "السبت",
      "8:00 PM",
      "2025-04-10",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Arabic Sheet");

  const result = parseWorkbookData(wb);

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].groupCode, "GRP-ARABIC-1");
  assert.equal(result.groups[0].coordinatorName, "محمود حسن");
  assert.equal(result.groups[0].coordinatorEmail, "mahmoud@example.com");
  assert.equal(result.groups[0].startDate, "2025-04-10");
});

