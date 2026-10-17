import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Search,
  UsersRound,
} from "lucide-react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import {
  addWeeks,
  cairoToday,
  formatPhone,
  normalizeDate,
  readGroups,
} from "./importExcel";
import OperationsDashboard from "./OperationsDashboard";
import Sessions, { sessionDate, ZoomCredentials } from "./Sessions";
import "./app-layout.css";

const JOINED_STATUS = "دخل الجروب";

const STATUSES = [
  "لم يُرسل",
  "تم التواصل",
  "ردّ",
  JOINED_STATUS,
  "رقم خطأ",
  "يحتاج متابعة",
];

const STATUS_LABELS = {
  "لم يُرسل": "Not contacted",
  "تم التواصل": "Contacted",
  ردّ: "Replied",
  "دخل الجروب": "Joined group",
  "رقم خطأ": "Invalid number",
  "يحتاج متابعة": "Follow-up needed",
};

const CARD_CLASS = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm min-w-0";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#483BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3729E6] disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#F0EFFF] px-4 py-2 text-sm font-semibold text-[#3729E6] hover:bg-[#E4E1FF]";

const INPUT =
  "mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-[#483BFF]";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["lead", "project_manager"],
  },
  {
    id: "groups",
    label: "Groups",
    icon: UsersRound,
    roles: ["lead", "project_manager", "coordinator"],
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: CalendarDays,
    roles: ["lead", "project_manager", "coordinator"],
  },
  {
    id: "import",
    label: "Import Excel",
    icon: FileSpreadsheet,
    roles: ["lead"],
  },
];

function documentId(value) {
  return encodeURIComponent(String(value)).replaceAll("%", "_");
}

function studentKey(student) {
  return `${student.groupCode}:${student.userId || formatPhone(student.mobile)}`;
}

function whatsappUrl(phone, text) {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(text)}`;
}

function studentMessage(group) {
  return `بنرحب بيكم طلاب NTI - Creative (i-lance)
فى مرحلة الـ *Coaching*

معاكم ${group.coordinatorName} المنسق الخاص بالجروب، وهكون معاكم خلال مرحلة الكوتشنج.

والتى من المقرر بدأها:
يوم ${group.day || "..."}
الموافق ${group.startDate || "..."}
الساعة ${group.time || "..."}

وتستمر لمدة 10 أسابيع بمعدل Session واحدة أسبوعيًا في نفس اليوم والموعد.

*برجاء الانضمام لجروب الواتساب من الرابط التالي:*
${group.whatsappLink || "..."}

سيتم إرسال باقي التفاصيل على الجروب بعد دخول جميع الطلاب.

بالتوفيق ليكم جميعًا`;
}

function coachMessage(group) {
  return `أهلًا كابتن ${group.coachName}،
مع حضرتك ${group.coordinatorName}، منسق جروب ${group.groupCode} في مرحلة الـCoaching.

ده رابط جروب الواتساب:
${group.whatsappLink || "..."}

سعيد بالتنسيق مع حضرتك.`;
}

function sessionOperations(group) {
  const startDate = normalizeDate(group.startDate);

  return Array.from({ length: 10 }, (_, index) => ({
    collectionName: "sessions",
    id: documentId(`${group.groupCode}:session:${index + 1}`),
    data: {
      groupCode: group.groupCode,
      sessionNumber: index + 1,
      scheduledDate: addWeeks(startDate, index),
      time: group.time || "",
      coordinatorEmail: group.coordinatorEmail || "",
      coordinatorName: group.coordinatorName || "",
      coachName: group.coachName || "",
      trackName: group.trackName || "",
      zoomLink: group.zoomLink || "",
    },
  }));
}

async function commitOperations(operations) {
  for (let index = 0; index < operations.length; index += 400) {
    const batch = writeBatch(db);

    for (const operation of operations.slice(index, index + 400)) {
      batch.set(
        doc(db, operation.collectionName, operation.id),
        {
          ...operation.data,
          importedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    await batch.commit();
  }
}

function Sidebar({ page, onPageChange, user, role }) {
  const roleLabels = {
    lead: "Operations Lead",
    project_manager: "Project Manager",
    coordinator: "Coordinator",
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <LayoutDashboard size={21} />
        </div>
        <div>
          <strong>Coaching Ops</strong>
          <span>{roleLabels[role]}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map(
          ({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-link ${page === id ? "active" : ""}`}
              onClick={() => onPageChange(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ),
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-email" title={user.email || ""}>
          {user.email}
        </span>
        <button
          type="button"
          className="sidebar-logout"
          onClick={() => signOut(auth)}
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        String(form.get("email") || "").trim(),
        String(form.get("password") || ""),
      );
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-5 text-slate-900">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#483BFF]">
          Coaching Operations
        </p>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Use your assigned work account.
        </p>

        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={INPUT}
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={INPUT}
          />
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${PRIMARY_BUTTON} mt-6 w-full py-3`}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [credentials, setCredentials] = useState([]);

  const [page, setPage] = useState("dashboard");
  const [selectedCode, setSelectedCode] = useState("");
  const [groupDay, setGroupDay] = useState("all");
  const [groupSearch, setGroupSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [today, setToday] = useState(cairoToday);

  const role = profile?.role;
  const isLead = role === "lead";
  const isProjectManager = role === "project_manager";
  const canViewDashboard = isLead || isProjectManager;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(cairoToday()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    setProfile(undefined);
    setGroups([]);
    setStudents([]);
    setSessions([]);
    setCredentials([]);
    setError("");
    setNotice("");
    setSelectedCode("");
    setGroupSearch("");
    setStudentSearch("");
    setGroupDay("all");

    if (!user) return;

    getDoc(doc(db, "users", user.uid))
      .then((snapshot) => {
        if (active) {
          setProfile(snapshot.exists() ? snapshot.data() : null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setProfile(null);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!profile) return;

    setPage(
      profile.role === "lead" || profile.role === "project_manager"
        ? "dashboard"
        : "sessions",
    );
  }, [profile]);

  useEffect(() => {
    if (!user || !["lead", "project_manager", "coordinator"].includes(role)) {
      return;
    }

    const canViewAll = role === "lead" || role === "project_manager";

    const email = (user.email || "").toLowerCase();

    function scopedQuery(name, all) {
      return all
        ? collection(db, name)
        : query(collection(db, name), where("coordinatorEmail", "==", email));
    }

    function subscribe(name, setter, all = canViewAll) {
      return onSnapshot(
        scopedQuery(name, all),
        (snapshot) => {
          setter(
            snapshot.docs.map((item) => ({
              ...item.data(),
              id: item.id,
            })),
          );
        },
        (err) => setError(err.message),
      );
    }
    const unsubscribers = [
      subscribe("groups", setGroups),
      subscribe("students", setStudents),
      subscribe("sessions", setSessions),
    ];

    if (role !== "project_manager") {
      unsubscribers.push(
        subscribe("zoomCredentials", setCredentials, role === "lead"),
      );
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, role]);

  const availableDays = useMemo(
    () =>
      [...new Set(groups.map((group) => group.day).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [groups],
  );

  const studentsByGroup = useMemo(() => {
    const result = new Map();

    for (const student of students) {
      const current = result.get(student.groupCode) || [];
      current.push(student);
      result.set(student.groupCode, current);
    }

    return result;
  }, [students]);

  const filteredGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();

    return groups.filter((group) => {
      if (groupDay !== "all" && group.day !== groupDay) return false;
      if (!term) return true;

      const linkedStudents = studentsByGroup.get(group.groupCode) || [];

      return [
        group.groupCode,
        group.batchCode,
        group.trackName,
        group.coordinatorName,
        group.coordinatorEmail,
        group.coachName,
        group.coachPhone,
        group.day,
        group.startDate,
        group.time,
        ...linkedStudents.flatMap((student) => [
          student.name,
          student.mobile,
          student.email,
          student.userId,
          student.status,
          STATUS_LABELS[student.status],
          student.gender,
          student.moduleName,
          student.batch,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [groups, groupDay, groupSearch, studentsByGroup]);

  const selectedGroup =
    filteredGroups.find((group) => group.groupCode === selectedCode) ||
    filteredGroups[0];

  const groupStudents = selectedGroup
    ? studentsByGroup.get(selectedGroup.groupCode) || []
    : [];

  const selectedCredentials = credentials.find(
    (item) => item.groupCode === selectedGroup?.groupCode,
  );

  const filteredStudents = groupStudents.filter((student) => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return true;

    return [
      student.name,
      student.mobile,
      student.email,
      student.userId,
      student.status,
      STATUS_LABELS[student.status],
      student.gender,
      student.studentType,
      student.moduleName,
      student.batch,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const defaultMessage = selectedGroup ? studentMessage(selectedGroup) : "";

  useEffect(() => {
    setMessage(defaultMessage);
  }, [defaultMessage]);

  const sessionSummary = {
    today: sessions.filter((session) => sessionDate(session) === today).length,
    upcoming: sessions.filter(
      (session) =>
        sessionDate(session) > today &&
        !["Completed", "Cancelled"].includes(session.status),
    ).length,
    completed: sessions.filter((session) => session.status === "Completed")
      .length,
    attendance: sessions.reduce(
      (total, session) => total + (Number(session.attendanceCount) || 0),
      0,
    ),
  };

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Could not copy. Please copy the text manually.");
    }
  }

  async function importFiles(event) {
    event.preventDefault();
    if (!isLead || importing || generating) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setError("");
    setNotice("");
    setImporting(true);

    try {
      const importedGroups = await readGroups(form.get("groupsFile"));

      const groupMap = new Map();

      // Validate the workbook before any Firebase writes.
      for (const group of importedGroups) {
        if (groupMap.has(group.groupCode)) {
          throw new Error(
            `Duplicate Group Code across Excel tabs: ${group.groupCode}`,
          );
        }

        groupMap.set(group.groupCode, group);
      }

      const [existingStudents, existingSessions] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "sessions")),
      ]);

      const existingSessionIds = new Set(
        existingSessions.docs.map((item) => item.id),
      );

      const operations = [];
      let newSessions = 0;
      let reassignedStudents = 0;
      let reassignedSessions = 0;

      for (const group of importedGroups) {
        const { zoomUserId, zoomPassword, ...publicGroup } = group;

        operations.push({
          collectionName: "groups",
          id: documentId(group.groupCode),
          data: publicGroup,
        });

        operations.push({
          collectionName: "zoomCredentials",
          id: documentId(group.groupCode),
          data: {
            groupCode: group.groupCode,
            coordinatorEmail: group.coordinatorEmail,
            zoomUserId,
            zoomPassword,
          },
        });

        // Create only missing sessions.
        for (const operation of sessionOperations(publicGroup)) {
          if (!existingSessionIds.has(operation.id)) {
            operations.push(operation);
            newSessions += 1;
          }
        }
      }

      // Preserve existing students and their statuses.
      // Update coordinator assignment when changed in Excel.
      for (const snapshot of existingStudents.docs) {
        const student = snapshot.data();
        const group = groupMap.get(student.groupCode);

        if (group && student.coordinatorEmail !== group.coordinatorEmail) {
          operations.push({
            collectionName: "students",
            id: snapshot.id,
            data: {
              coordinatorEmail: group.coordinatorEmail,
            },
          });

          reassignedStudents += 1;
        }
      }

      // Keep existing session progress and update assignments.
      for (const snapshot of existingSessions.docs) {
        const session = snapshot.data();
        const group = groupMap.get(session.groupCode);

        if (group && session.coordinatorEmail !== group.coordinatorEmail) {
          operations.push({
            collectionName: "sessions",
            id: snapshot.id,
            data: {
              coordinatorEmail: group.coordinatorEmail,
            },
          });

          reassignedSessions += 1;
        }
      }

      await commitOperations(operations);
      formElement.reset();

      setNotice(
        `Imported ${importedGroups.length} groups from all Excel tabs. ` +
          `Created ${newSessions} missing sessions. ` +
          `Updated assignments for ${reassignedStudents} existing students and ` +
          `${reassignedSessions} sessions. Existing student statuses and session progress were preserved.`,
      );
    } catch (err) {
      setError(
        `${err.message} If some batches were saved before an error, re-importing the same workbook is safe.`,
      );
    } finally {
      setImporting(false);
    }
  }

  async function generateExistingSessions() {
    if (!isLead || generating || importing) return;

    setGenerating(true);
    setError("");
    setNotice("");

    try {
      const operations = groups.flatMap((group) => {
        try {
          return sessionOperations(group);
        } catch (err) {
          throw new Error(`Group "${group.groupCode}": ${err.message}`);
        }
      });

      await commitOperations(operations);

      setNotice(
        `Created or updated ${groups.length * 10} sessions. Saved attendance, notes and rescheduling were preserved.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function changeStatus(student, status) {
    if (isProjectManager) return;

    setError("");

    try {
      await updateDoc(doc(db, "students", student.id), {
        status,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  if (user === undefined || (user && profile === undefined)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">
        Loading...
      </div>
    );
  }

  if (!user) return <Login />;

  if (!profile || !["lead", "project_manager", "coordinator"].includes(role)) {
    return (
      <div className="mx-auto mt-24 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold">Account awaiting activation</h2>
        <p className="mt-3 text-sm text-slate-600">
          Your account needs an assigned role.
        </p>
        <code className="mt-3 block break-all rounded-lg bg-slate-100 p-3 text-sm">
          {user.uid}
        </code>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button
          type="button"
          onClick={() => signOut(auth)}
          className={`${PRIMARY_BUTTON} mt-5`}
        >
          Sign out
        </button>
      </div>
    );
  }

  const headings = {
    dashboard: isProjectManager
      ? "Project Manager Dashboard"
      : "Operations Dashboard",
    groups: "Groups Management",
    sessions: "Sessions",
    import: "Import Excel",
  };

  const descriptions = {
    dashboard: "Track groups, coordinators, membership, and sessions.",
    groups: "Search and manage groups and students.",
    sessions: "Manage weekly sessions and track attendance.",
    import: "Upload one database workbook containing all group tabs.",
  };

  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          setNotice("");
        }}
        user={user}
        role={role}
      />

      <main className="app-main">
        <div className="app-content">
          <header className="page-heading">
            <p className="text-xs font-bold text-[#483BFF]">
              NTI · Creative i-Lance
            </p>
            <h1>{headings[page]}</h1>
            <p>{descriptions[page]}</p>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              {notice}
            </div>
          )}

          {canViewDashboard && page === "dashboard" && (
            <>
              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Today's sessions", sessionSummary.today],
                  ["Upcoming scheduled sessions", sessionSummary.upcoming],
                  ["Completed sessions", sessionSummary.completed],
                  ["Recorded attendance total", sessionSummary.attendance],
                ].map(([label, count]) => (
                  <div key={label} className={CARD_CLASS}>
                    <p className="text-sm text-slate-500">{label}</p>
                    <strong className="mt-2 block text-3xl text-[#483BFF]">
                      {count}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="mb-5 text-xs text-slate-500">
                Session totals cover all accessible groups. Attendance is the
                sum across sessions, so a student may be counted more than once.
              </p>{" "}
              <OperationsDashboard
                groups={groups}
                students={students}
                mode={isProjectManager ? "project_manager" : "operations"}
              />
            </>
          )}

          {page === "sessions" && (
            <>
              {isLead && (
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    disabled={generating || importing || !groups.length}
                    onClick={generateExistingSessions}
                  >
                    <CalendarDays size={17} />
                    {generating
                      ? "Generating..."
                      : "Generate / sync group sessions"}
                  </button>
                  <span className="text-xs text-slate-500">
                    10 weekly sessions per group.
                  </span>
                </div>
              )}

              <Sessions
                sessions={sessions}
                groups={groups}
                credentials={credentials}
                user={user}
                role={role}
                onError={setError}
              />
            </>
          )}

          {isLead && page === "import" && (
            <section className={CARD_CLASS}>
              <h2 className="text-lg font-bold">Import groups database</h2>

              <p className="mt-1 text-sm text-slate-500">
                Upload one Excel database workbook. All tabs containing Group
                Code will be read, including old and new groups. Student sheet
                links come from the Table column.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Existing students, their statuses, and session progress are
                kept. No Google Sheet is read or modified. New students are not
                imported.
              </p>

              <form
                onSubmit={importFiles}
                className="mt-5 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <label className="block min-w-0 flex-1 text-sm font-medium">
                  Database Excel file
                  <input
                    name="groupsFile"
                    type="file"
                    accept=".xlsx,.xls"
                    required
                    className="mt-2 block w-full min-w-0 max-w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2"
                  />
                </label>

                <button
                  type="submit"
                  disabled={importing || generating}
                  className={PRIMARY_BUTTON}
                >
                  {importing ? "Importing..." : "Import data"}
                </button>
              </form>
            </section>
          )}

          {page === "groups" && (
            <>
              <div className="mb-5 grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
                <label className="min-w-0 text-sm font-semibold">
                  Day
                  <select
                    value={groupDay}
                    onChange={(event) => {
                      setGroupDay(event.target.value);
                      setSelectedCode("");
                    }}
                    className={INPUT}
                  >
                    <option value="all">All days</option>
                    {availableDays.map((day) => (
                      <option key={day}>{day}</option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-sm font-semibold">
                  Group
                  <select
                    value={selectedGroup?.groupCode || ""}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    className={INPUT}
                  >
                    {!filteredGroups.length && (
                      <option value="">No matching groups</option>
                    )}

                    {filteredGroups.map((group) => (
                      <option key={group.id} value={group.groupCode}>
                        {group.groupCode}
                        {group.coordinatorName
                          ? ` — ${group.coordinatorName}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-sm font-semibold">
                  Search any data
                  <span className="relative block">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={groupSearch}
                      onChange={(event) => {
                        setGroupSearch(event.target.value);
                        setSelectedCode("");
                      }}
                      placeholder="Name, phone, group, coach..."
                      className={`${INPUT} pl-10`}
                    />
                  </span>
                </label>
              </div>

              <p className="mb-5 text-sm text-slate-600">
                {filteredGroups.length} groups · {groupStudents.length} students
                in selected group
              </p>

              {!selectedGroup ? (
                <section className={CARD_CLASS}>
                  <p className="text-sm text-slate-500">
                    No groups match your filters.
                  </p>
                </section>
              ) : (
                <>
                  <section className={`${CARD_CLASS} mb-5`}>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#483BFF]">
                          Group overview
                        </p>

                        <h2 className="mt-1 break-words text-xl font-bold">
                          {selectedGroup.groupCode}
                        </h2>

                        <p className="text-sm text-slate-500">
                          {selectedGroup.trackName}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full bg-[#F0EFFF] px-4 py-2 text-sm font-semibold text-[#3729E6]">
                        <CheckCircle2 size={16} />
                        {
                          groupStudents.filter(
                            (student) => student.status === JOINED_STATUS,
                          ).length
                        }{" "}
                        / {groupStudents.length} joined
                      </span>
                    </div>

                    <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        ["Coordinator", selectedGroup.coordinatorName],
                        ["Coach", selectedGroup.coachName],
                        ["Day", selectedGroup.day],
                        ["Start date", selectedGroup.startDate],
                        ["Time", selectedGroup.time],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                          <span className="block text-xs text-slate-500">
                            {label}
                          </span>
                          <strong className="mt-1 block text-sm">
                            {value || "—"}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium text-[#483BFF]">
                      {[
                        ["Open Zoom", selectedGroup.zoomLink],
                        ["Open WhatsApp group", selectedGroup.whatsappLink],
                        ["Open students sheet", selectedGroup.tableLink],
                      ]
                        .filter(([, link]) => link)
                        .map(([label, link]) => (
                          <a
                            key={label}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-w-0 items-center gap-1 break-words"
                          >
                            {label}
                            <ExternalLink size={15} />
                          </a>
                        ))}
                    </div>

                    {!isProjectManager && (
                      <ZoomCredentials
                        credentials={selectedCredentials}
                        onError={setError}
                      />
                    )}

                    {selectedGroup.expectedStudents != null &&
                      Number(selectedGroup.expectedStudents) !==
                        groupStudents.length && (
                        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                          Student count mismatch:{" "}
                          {selectedGroup.expectedStudents} expected,{" "}
                          {groupStudents.length} imported.
                        </p>
                      )}
                  </section>

                  <section className={`${CARD_CLASS} mb-5`}>
                    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-bold">Student message</h2>

                      <button
                        type="button"
                        className={SECONDARY_BUTTON}
                        onClick={() => copyText(message)}
                      >
                        <Copy size={16} />
                        Copy message
                      </button>
                    </div>

                    <textarea
                      dir="rtl"
                      rows={11}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      className="block w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 outline-[#483BFF] sm:p-4"
                    />

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON}
                        onClick={() => copyText(coachMessage(selectedGroup))}
                      >
                        <Copy size={16} />
                        Copy coach message
                      </button>

                      {formatPhone(selectedGroup.coachPhone) &&
                        selectedGroup.whatsappLink && (
                          <a
                            className={PRIMARY_BUTTON}
                            href={whatsappUrl(
                              selectedGroup.coachPhone,
                              coachMessage(selectedGroup),
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={16} />
                            Message coach
                          </a>
                        )}
                    </div>
                  </section>

                  <section className={CARD_CLASS}>
                    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-bold">Group students</h2>

                      <input
                        type="search"
                        placeholder="Search student data"
                        value={studentSearch}
                        onChange={(event) =>
                          setStudentSearch(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-[#483BFF] sm:w-80"
                      />
                    </div>

                    <div className="students-table-wrap overflow-x-auto">
                      <table className="students-table w-full min-w-[650px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            {["Student", "Phone", "Status", "Action"].map(
                              (heading) => (
                                <th key={heading} className="px-4 py-3">
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {filteredStudents.map((student) => (
                            <tr
                              key={student.id}
                              className="border-t border-slate-100"
                            >
                              <td data-label="Student" className="px-4 py-3">
                                <strong className="block break-words">
                                  {student.name || "Unnamed"}
                                </strong>
                                <span className="text-xs text-slate-400">
                                  {student.userId}
                                </span>
                              </td>

                              <td data-label="Phone" className="px-4 py-3">
                                {student.mobile || "—"}
                              </td>

                              <td data-label="Status" className="px-4 py-3">
                                {isProjectManager ? (
                                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs">
                                    {STATUS_LABELS[student.status] ||
                                      student.status ||
                                      "Not contacted"}
                                  </span>
                                ) : (
                                  <select
                                    value={student.status || "لم يُرسل"}
                                    onChange={(event) =>
                                      changeStatus(student, event.target.value)
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                                  >
                                    {STATUSES.map((status) => (
                                      <option key={status} value={status}>
                                        {STATUS_LABELS[status]}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              <td data-label="Action" className="px-4 py-3">
                                {formatPhone(student.mobile) &&
                                selectedGroup.whatsappLink ? (
                                  <a
                                    className={PRIMARY_BUTTON}
                                    href={whatsappUrl(student.mobile, message)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MessageCircle size={16} />
                                    Open WhatsApp
                                  </a>
                                ) : (
                                  <span className="text-xs text-amber-700">
                                    Check phone or group link
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}

                          {!filteredStudents.length && (
                            <tr>
                              <td
                                colSpan={4}
                                className="students-empty px-4 py-8 text-center text-slate-500"
                              >
                                No students match your search.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!isProjectManager && (
                      <p className="mt-4 text-xs text-slate-500">
                        Update the status after sending. Confirm “Joined group”
                        only after checking WhatsApp.
                      </p>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
