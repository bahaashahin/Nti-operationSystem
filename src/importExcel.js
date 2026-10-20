import * as XLSX from "xlsx";

export const UNKNOWN = "Unknown";

export const norm = (v) =>
  String(v ?? "")
    .replace(/\uFEFF|\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const val = (v) => String(v ?? "").trim();

export const isUnknown = (v) => {
  const s = val(v);
  if (!s) return true;
  const n = norm(s);
  return (
    n === "unknown" ||
    n === "null" ||
    n === "undefined" ||
    n === "none" ||
    n === "n/a" ||
    n === "-" ||
    n === "--"
  );
};

export function makeDateKey(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`Invalid date values: ${y}-${m}-${d}`);
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const PRIORITY_OR_STATUS_KEYWORDS = new Set([
  "high",
  "medium",
  "low",
  "normal",
  "urgent",
  "critical",
  "active",
  "inactive",
  "pending",
  "completed",
  "scheduled",
  "cancelled",
  "canceled",
  "not contacted",
  "contacted",
  "replied",
  "joined",
  "invalid",
  "follow-up",
  "null",
  "undefined",
  "none",
  "n/a",
  "tbd",
  "unknown",
  "عالي",
  "متوسط",
  "منخفض",
  "عاجل",
]);

const MONTH_NAMES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const defaultExportKey = Object.keys(XLSX).find((k) => k.startsWith("def"));
const SSF = XLSX.SSF || (defaultExportKey ? XLSX[defaultExportKey]?.SSF : undefined);

export function tryParseDate(input) {
  if (isUnknown(input)) {
    return { valid: true, dateKey: UNKNOWN };
  }

  const s = val(input);
  const n = norm(s);

  if (PRIORITY_OR_STATUS_KEYWORDS.has(n)) {
    return {
      valid: false,
      reason: `Cannot read date "${s}". Value appears to be a priority or status keyword, not a valid date.`,
    };
  }

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    try {
      const key = makeDateKey(
        input.getUTCFullYear(),
        input.getUTCMonth() + 1,
        input.getUTCDate(),
      );
      return { valid: true, dateKey: key };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }

  if (typeof input === "number") {
    // Valid Excel serial dates for recent years: ~35000 (1995) to ~65000 (2077)
    if (input >= 25569 && input <= 73050 && SSF?.parse_date_code) {
      const d = SSF.parse_date_code(input);
      if (d && d.y >= 2000 && d.y <= 2050) {
        try {
          return { valid: true, dateKey: makeDateKey(d.y, d.m, d.d) };
        } catch (e) {
          return { valid: false, reason: e.message };
        }
      }
    }
    return {
      valid: false,
      reason: `Number ${input} is not a valid Excel date code.`,
    };
  }

  // Must contain at least one digit to be a date string
  if (!/\d/.test(s)) {
    return {
      valid: false,
      reason: `Cannot read date "${s}". Text contains no numbers.`,
    };
  }

  // YYYY-MM-DD or YYYY/MM/DD
  let match = s.match(/^(\d{4})[\/. -](\d{1,2})[\/. -](\d{1,2})$/);
  if (match) {
    const y = +match[1];
    const m = +match[2];
    const d = +match[3];
    if (y >= 2000 && y <= 2050 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      try {
        return { valid: true, dateKey: makeDateKey(y, m, d) };
      } catch (e) {
        return { valid: false, reason: e.message };
      }
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  match = s.match(/^(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{2}|\d{4})$/);
  if (match) {
    let p1 = +match[1];
    let p2 = +match[2];
    let y = +match[3] < 100 ? 2000 + +match[3] : +match[3];

    let day = p1;
    let month = p2;

    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    }

    if (y >= 2000 && y <= 2050 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      try {
        return { valid: true, dateKey: makeDateKey(y, month, day) };
      } catch (e) {
        return { valid: false, reason: e.message };
      }
    }
  }

  // Handle strings with weekday names or month names, e.g. "Saturday, 15 Feb 2025" or "15 Feb 2025"
  const cleaned = s
    .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, "")
    .trim();

  // Pattern: "15 Feb 2025" or "15-Feb-2025"
  const textMonthMatch = cleaned.match(
    /^(\d{1,2})[\s\/-]+([A-Za-z]+)[\s\/-]+(\d{2,4})$/,
  );
  if (textMonthMatch) {
    const day = +textMonthMatch[1];
    const monthStr = textMonthMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthStr];
    const y = +textMonthMatch[3] < 100 ? 2000 + +textMonthMatch[3] : +textMonthMatch[3];

    if (month && y >= 2000 && y <= 2050) {
      try {
        return { valid: true, dateKey: makeDateKey(y, month, day) };
      } catch (e) {
        return { valid: false, reason: e.message };
      }
    }
  }

  // Pattern: "Feb 15, 2025"
  const textMonthPrefixMatch = cleaned.match(
    /^([A-Za-z]+)[\s\/-]+(\d{1,2}),?[\s\/-]+(\d{2,4})$/,
  );
  if (textMonthPrefixMatch) {
    const monthStr = textMonthPrefixMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthStr];
    const day = +textMonthPrefixMatch[2];
    const y = +textMonthPrefixMatch[3] < 100 ? 2000 + +textMonthPrefixMatch[3] : +textMonthPrefixMatch[3];

    if (month && y >= 2000 && y <= 2050) {
      try {
        return { valid: true, dateKey: makeDateKey(y, month, day) };
      } catch (e) {
        return { valid: false, reason: e.message };
      }
    }
  }

  return {
    valid: false,
    reason: `Cannot read date "${s}". Unrecognized date format.`,
  };
}

export function normalizeDate(input) {
  const res = tryParseDate(input);
  if (res.valid) {
    return res.dateKey;
  }
  throw new Error(res.reason);
}

export function addWeeks(dateKey, weeks) {
  const key = normalizeDate(dateKey);
  if (key === UNKNOWN) return UNKNOWN;

  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + weeks * 7));

  return makeDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function cairoToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dateLabel(dateKey) {
  if (isUnknown(dateKey)) return UNKNOWN;

  try {
    const [y, m, d] = normalizeDate(dateKey).split("-").map(Number);

    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return UNKNOWN;
  }
}

export function formatPhone(phone) {
  if (isUnknown(phone)) return "";

  let s = String(phone).replace(/\D/g, "");

  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("0") && s.length === 11) s = `2${s}`;

  return s;
}

const CANONICAL_ALIASES = {
  groupCode: ["group code", "group", "groupcode", "code", "كود الجروب", "الجروب", "كود المجموعة"],
  batchCode: ["batch code", "batch", "الدفعة", "دفعة"],
  trackName: ["track name", "track", "التراك", "المسار"],
  coordinatorName: [
    "group coordinator",
    "coordinator",
    "coordinator name",
    "group coordinator name",
    "المنسق",
    "منسق الجروب",
    "اسم المنسق",
  ],
  coordinatorEmail: [
    "group coordinator email",
    "coordinator email",
    "email coordinator",
    "ايميل المنسق",
    "بريد المنسق",
  ],
  coachName: ["coach", "coach name", "المدرب", "الكوتش", "اسم المدرب"],
  coachPhone: ["coach phone", "phone.1", "phone_1", "coach mobile", "رقم المدرب", "موبايل المدرب"],
  day: ["day", "scheduled day", "اليوم"],
  time: ["time", "group time", "الموعد", "الساعة", "الوقت"],
  startDate: [
    "start date",
    "starting date",
    "startdate",
    "date of start",
    "تاريخ البدء",
    "تاريخ البداية",
    "تاريخ بداية الجروب",
  ],
  priority: ["priority", "الأولوية", "درجة الأهمية"],
  expectedStudents: [
    "no. of students",
    "number of students",
    "students count",
    "no of students",
    "عدد الطلاب",
    "العدد",
  ],
  zoomLink: ["zoom link", "zoom", "رابط زوم", "لينك زوم"],
  whatsappLink: [
    "whatsapp group link",
    "whatsapp link",
    "whatsapp",
    "رابط الواتساب",
    "جروب الواتساب",
    "لينك الواتساب",
  ],
  tableLink: ["table", "students sheet", "student sheet", "sheet", "شيت الطلاب", "الجدول"],
  zoomUserId: ["zoom user id", "zoom user", "zoom email", "zoom account", "ايميل زوم"],
  zoomPassword: ["pass", "zoom pass", "zoom password", "password", "باسورد زوم"],
  studentName: ["english name", "student name", "name", "اسم الطالب", "الاسم"],
  studentMobile: ["mobile", "phone", "student phone", "الموبايل", "رقم الهاتف", "الهاتف"],
  studentUserId: ["user id", "student id", "id", "كود الطالب", "رقم القيد"],
  studentEmail: ["email", "student email", "البريد الإلكتروني", "الايميل"],
  gender: ["gender", "النوع", "الجنس"],
  studentType: ["graduate/student", "student type", "خريج/طالب", "نوع الطالب"],
  moduleName: ["module name", "module", "اسم الموديل", "الموديل"],
  studentBatch: ["student batch", "batch", "الدفعة"],
  studentStatus: ["status", "حالة الطالب", "الحالة"],
};

function matchCanonicalKey(headerText) {
  const normalized = norm(headerText);
  if (!normalized) return null;

  // 1. Exact match across all aliases
  for (const [key, aliases] of Object.entries(CANONICAL_ALIASES)) {
    if (aliases.some((alias) => normalized === alias)) {
      return key;
    }
  }

  // 2. Whole word boundary match, prioritizing longer aliases
  const allAliases = [];
  for (const [key, aliases] of Object.entries(CANONICAL_ALIASES)) {
    for (const alias of aliases) {
      allAliases.push({ key, alias });
    }
  }
  allAliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const { key, alias } of allAliases) {
    const escaped = alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp("(^|\\s|_|-)" + escaped + "($|\\s|_|-)", "i");
    if (regex.test(normalized)) {
      return key;
    }
  }

  return null;
}

function findHeaderRow(grid) {
  let bestIndex = -1;
  let maxScore = 0;

  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const row = grid[r] || [];
    let score = 0;
    let hasGroupCode = false;

    for (const cell of row) {
      const match = matchCanonicalKey(cell);
      if (match) {
        score += 1;
        if (match === "groupCode") hasGroupCode = true;
      }
    }

    if (hasGroupCode && score > maxScore) {
      maxScore = score;
      bestIndex = r;
    }
  }

  return bestIndex;
}

function extractHyperlink(sheet, range, headerIndex, excelRow, colIndex, cellVal) {
  if (colIndex < 0) return "";

  const address = XLSX.utils.encode_cell({
    r: excelRow - 1,
    c: range.s.c + colIndex,
  });

  const cell = sheet ? sheet[address] : null;
  let link = cell?.l?.Target || "";

  if (!link && cell?.f) {
    const formula = cell.f.match(/^HYPERLINK\(\s*"([^"]+)"/i);
    if (formula) link = formula[1];
  }

  if (!link) link = val(cellVal);
  if (!/^https?:\/\//i.test(link)) return "";

  return link;
}

export function parseWorkbookData(workbook) {
  if (!workbook || !workbook.SheetNames) {
    throw new Error("Invalid Excel workbook.");
  }

  const groupBuckets = new Map();
  const invalidRows = [];
  const skippedGroups = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const grid = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: true,
    });

    const headerIndex = findHeaderRow(grid);
    if (headerIndex < 0) continue;

    const headerRow = grid[headerIndex];
    const columnMap = {};

    headerRow.forEach((cell, idx) => {
      const canonical = matchCanonicalKey(cell);
      if (canonical && columnMap[canonical] === undefined) {
        columnMap[canonical] = idx;
      }
    });

    // Fallback: look for second phone column as coach phone if not explicitly labeled
    if (columnMap.coachPhone === undefined) {
      const phoneCols = headerRow
        .map((cell, idx) => (norm(cell).includes("phone") || norm(cell).includes("mobile") ? idx : -1))
        .filter((i) => i >= 0);
      if (phoneCols.length > 1) {
        columnMap.coachPhone = phoneCols[1];
      }
    }

    let activeGroupCode = "";

    for (let i = headerIndex + 1; i < grid.length; i++) {
      const cells = grid[i] || [];
      const excelRow = range.s.r + i + 1;

      const get = (key) => {
        const col = columnMap[key];
        return col !== undefined ? cells[col] ?? "" : "";
      };

      const rawGroupCode = val(get("groupCode"));
      const studentName = val(get("studentName"));
      const studentMobile = val(get("studentMobile"));
      const studentUserId = val(get("studentUserId"));

      // Determine active groupCode (handles contiguous student rows under a group)
      if (rawGroupCode) {
        activeGroupCode = rawGroupCode;
      } else if (!activeGroupCode || (!studentName && !studentMobile && !studentUserId)) {
        continue;
      }

      const groupCode = activeGroupCode;

      if (!groupBuckets.has(groupCode)) {
        groupBuckets.set(groupCode, {
          groupCode,
          sheetName,
          excelRow,
          rows: [],
          metadata: {},
          students: [],
        });
      }

      const bucket = groupBuckets.get(groupCode);
      bucket.rows.push({ cells, excelRow, get });

      // Gather student row if present
      if (studentName || studentMobile || studentUserId) {
        bucket.students.push({
          groupCode,
          userId: studentUserId,
          name: studentName || UNKNOWN,
          mobile: studentMobile,
          email: val(get("studentEmail")) || UNKNOWN,
          gender: val(get("gender")) || UNKNOWN,
          studentType: val(get("studentType")) || UNKNOWN,
          moduleName: val(get("moduleName")) || UNKNOWN,
          batch: val(get("studentBatch")) || UNKNOWN,
          status: val(get("studentStatus")) || "لم يُرسل",
          excelRow,
          sheetName,
        });
      }
    }

    // Now process all groups found in this sheet
    for (const [groupCode, bucket] of groupBuckets.entries()) {
      if (bucket.processed || bucket.sheetName !== sheetName) continue;
      bucket.processed = true;

      // Extract first non-empty value across all rows for this group
      const pick = (key) => {
        for (const r of bucket.rows) {
          const v = r.get(key);
          if (!isUnknown(v)) return v;
        }
        return "";
      };

      const coordinatorName = val(pick("coordinatorName"));
      const coordinatorEmail = val(pick("coordinatorEmail")).toLowerCase();

      // REQUIREMENT 1.1: Group must have an assigned coordinator
      const hasCoordinator = Boolean(
        coordinatorName &&
        norm(coordinatorName) !== "unknown" &&
        coordinatorName.trim() !== ""
      );

      if (!hasCoordinator) {
        skippedGroups.push({
          sheetName,
          groupCode,
          excelRow: bucket.excelRow,
          reason: "No Group Coordinator assigned (cell is empty or unassigned)",
        });
        continue;
      }

      // Extract and validate Start Date safely from the validated Start Date column only
      const rawStartDate = pick("startDate");
      const dateParseResult = tryParseDate(rawStartDate);

      if (!dateParseResult.valid) {
        invalidRows.push({
          sheetName,
          groupCode,
          excelRow: bucket.excelRow,
          reason: dateParseResult.reason,
        });
        // Skip this invalid group independently without crashing the entire workbook
        continue;
      }

      const count = val(pick("expectedStudents"));
      const expected = Number(count);
      const timeVal = pick("time");

      const tableLink = extractHyperlink(
        sheet,
        range,
        headerIndex,
        bucket.excelRow,
        columnMap.tableLink ?? -1,
        pick("tableLink"),
      );

      const coachPhone =
        val(pick("coachPhone")) ||
        val(bucket.rows[0]?.get("coachPhone"));

      bucket.finalGroup = {
        groupCode,
        batchCode: val(pick("batchCode")) || UNKNOWN,
        expectedStudents:
          count !== "" && Number.isFinite(expected) && expected >= 0
            ? expected
            : null,
        startDate: dateParseResult.dateKey,
        trackName: val(pick("trackName")) || UNKNOWN,
        coordinatorName,
        coordinatorEmail,
        day: val(pick("day")) || UNKNOWN,
        time:
          typeof timeVal === "number"
            ? XLSX.SSF.format("h:mm AM/PM", timeVal)
            : val(timeVal) || UNKNOWN,
        zoomLink: val(pick("zoomLink")),
        whatsappLink: val(pick("whatsappLink")),
        tableLink,
        coachName: val(pick("coachName")) || UNKNOWN,
        coachPhone: coachPhone || UNKNOWN,
        zoomUserId: val(pick("zoomUserId")),
        zoomPassword: val(pick("zoomPassword")),
        sheetName,
        excelRow: bucket.excelRow,
      };
    }
  }

  // Deduplicate and collect final groups and students
  const validGroups = [];
  const validStudents = [];
  const seenStudentKeys = new Set();

  for (const bucket of groupBuckets.values()) {
    if (bucket.finalGroup) {
      validGroups.push(bucket.finalGroup);

      for (const st of bucket.students) {
        const key = `${st.groupCode}:${st.userId || formatPhone(st.mobile) || st.name}`;
        if (!seenStudentKeys.has(key)) {
          seenStudentKeys.add(key);
          validStudents.push({
            ...st,
            coordinatorEmail: bucket.finalGroup.coordinatorEmail,
          });
        }
      }
    }
  }

  return {
    groups: validGroups,
    students: validStudents,
    skippedGroups,
    invalidRows,
  };
}

export async function readWorkbook(file) {
  if (!file || !file.size) {
    throw new Error("Choose a valid Excel database file.");
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    cellFormula: true,
    cellStyles: true,
  });

  return parseWorkbookData(workbook);
}

// Retained for backward compatibility
export async function readGroups(file) {
  const { groups, invalidRows } = await readWorkbook(file);

  if (invalidRows.length && !groups.length) {
    const firstErr = invalidRows[0];
    throw new Error(
      `${firstErr.sheetName} row ${firstErr.excelRow} (${firstErr.groupCode}): ${firstErr.reason}`,
    );
  }

  if (!groups.length) {
    throw new Error('No assigned groups found. Check "Group Coordinator" column.');
  }

  return groups;
}

// Retained for backward compatibility
export async function readStudents(file) {
  const { students } = await readWorkbook(file);
  return students;
}
