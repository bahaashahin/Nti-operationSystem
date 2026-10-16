import * as XLSX from "xlsx";

const UNKNOWN = "Unknown";

const norm = (v) =>
  String(v ?? "")
    .replace(/\uFEFF|\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const val = (v) => String(v ?? "").trim();

const isUnknown = (v) => !val(v) || norm(v) === "unknown";

function makeDateKey(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error("Invalid date");
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizeDate(input) {
  if (isUnknown(input)) return UNKNOWN;
if (input instanceof Date && !Number.isNaN(input.getTime())) {
  return makeDateKey(
    input.getUTCFullYear(),
    input.getUTCMonth() + 1,
    input.getUTCDate(),
  );
}

  if (typeof input === "number") {
    const d = XLSX.SSF.parse_date_code(input);
    if (d) return makeDateKey(d.y, d.m, d.d);
  }

  const s = val(input);

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return makeDateKey(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{2}|\d{4})$/);

  if (m) {
    return makeDateKey(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  }

  const cleaned = s.replace(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i,
    "",
  );

  const d = new Date(cleaned);

  if (!Number.isNaN(d.getTime())) {
    return makeDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  throw new Error(`Cannot read date "${s}".`);
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

function sheetRecords(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: true,
  });

  const headerIndex = grid.findIndex((row) =>
    row.some((v) => norm(v) === "group code"),
  );

  if (headerIndex < 0) return [];

  const headers = grid[headerIndex].map(norm);

  const get = (cells, key) => cells[headers.indexOf(norm(key))] ?? "";

  return grid.slice(headerIndex + 1).map((cells, index) => {
    const excelRow = range.s.r + headerIndex + index + 2;
    const linkCol = headers.indexOf("table");

    const address =
      linkCol >= 0
        ? XLSX.utils.encode_cell({
            r: excelRow - 1,
            c: range.s.c + linkCol,
          })
        : null;

    const cell = address ? sheet[address] : null;

    let link = cell?.l?.Target || "";

    if (!link && cell?.f) {
      const formula = cell.f.match(/^HYPERLINK\(\s*"([^"]+)"/i);
      if (formula) link = formula[1];
    }

    if (!link) link = val(get(cells, "Table"));
    if (!/^https?:\/\//i.test(link)) link = "";

    return {
      cells,
      excelRow,
      get: (key) => get(cells, key),
      getNth: (key, n = 0) =>
        cells[
          headers
            .map((h, i) => (h === norm(key) ? i : -1))
            .filter((i) => i >= 0)[n]
        ] ?? "",
      tableLink: link,
    };
  });
}

export async function readGroups(file) {
  if (!file || !file.size) {
    throw new Error("Choose a valid Excel database file.");
  }

 const workbook = XLSX.read(await file.arrayBuffer(), {
   type: "array",
   cellDates: false,
   cellFormula: true,
   cellStyles: true,
 });

  const groups = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    for (const { get, getNth, excelRow, tableLink } of sheetRecords(sheet)) {
      const groupCode = val(get("Group Code"));
      if (!groupCode) continue;

      let startDate;

      try {
        startDate = normalizeDate(get("Start Date"));
      } catch (e) {
        throw new Error(
          `${sheetName} row ${excelRow} (${groupCode}): ${e.message}`,
        );
      }

      const email = val(get("Group Coordinator Email")).toLowerCase();
      const count = val(get("No. of Students"));
      const expected = Number(count);
      const time = get("Time");

      const phone =
        val(get("Coach Phone")) || val(get("Phone.1")) || val(get("Phone_1"));

      const coachPhone = phone || val(getNth("Phone", 1));

      groups.push({
        groupCode,
        batchCode: val(get("Batch Code")) || UNKNOWN,
        expectedStudents:
          count !== "" && Number.isFinite(expected) && expected >= 0
            ? expected
            : null,
        startDate,
        trackName: val(get("Track Name")) || UNKNOWN,
        coordinatorName: val(get("Group Coordinator")) || UNKNOWN,
        coordinatorEmail: email,
        day: val(get("Day")) || UNKNOWN,
        time:
          typeof time === "number"
            ? XLSX.SSF.format("h:mm AM/PM", time)
            : val(time) || UNKNOWN,
        zoomLink: val(get("Zoom Link")),
        whatsappLink: val(get("WhatsApp Group Link")),
        tableLink: val(tableLink),
        coachName: val(get("Coach")) || UNKNOWN,
        coachPhone: coachPhone || UNKNOWN,
        zoomUserId: val(get("Zoom User ID")) || val(get("Zoom User")),
        zoomPassword: val(get("Pass")) || val(get("Zoom Pass")),
      });
    }
  }

  if (!groups.length) {
    throw new Error('No groups found. Check the "Group Code" column.');
  }

  return groups;
}

// Retained for backward compatibility.
export async function readStudents(file) {
  if (!file?.size) {
    throw new Error("Choose a students Excel file.");
  }

  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const students = [];

  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];

    const grid = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    const i = grid.findIndex((r) =>
      ["group code", "english name", "mobile"].every((h) =>
        r.map(norm).includes(h),
      ),
    );

    if (i < 0) continue;

    const head = grid[i].map(norm);

    for (const cells of grid.slice(i + 1)) {
      const get = (h) => val(cells[head.indexOf(norm(h))]);

      if (!get("English Name") && !get("Mobile") && !get("User ID")) {
        continue;
      }

      students.push({
        groupCode: get("Group Code"),
        userId: get("User ID"),
        name: get("English Name") || UNKNOWN,
        mobile: get("Mobile"),
        email: get("Email") || UNKNOWN,
        gender: get("Gender") || UNKNOWN,
        studentType: get("Graduate/Student") || UNKNOWN,
        moduleName: get("Module Name") || UNKNOWN,
        batch: get("Batch") || UNKNOWN,
      });
    }
  }

  return students;
}
