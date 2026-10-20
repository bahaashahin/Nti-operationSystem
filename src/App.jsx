import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Sparkles,
  UsersRound,
  X,
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
  dateLabel,
  formatPhone,
  normalizeDate,
  readWorkbook,
} from "./importExcel";
import OperationsDashboard from "./OperationsDashboard";
import Sessions, { sessionDate, ZoomCredentials } from "./Sessions";
import NotificationCenter from "./components/NotificationCenter";
import ImportReport from "./components/ImportReport";
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

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm transition-all";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#483BFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#3729E6] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 transition-all";

const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F0EFFF] px-4 py-2.5 text-sm font-semibold text-[#3729E6] hover:bg-[#E4E1FF] active:scale-[0.99] disabled:opacity-50 transition-all";

const INPUT =
  "mt-1.5 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20";

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
  // Commit in chunks of 350 to stay well below Firestore's 500-write limit
  const chunkSize = 350;
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    const chunk = operations.slice(index, index + chunkSize);

    for (const operation of chunk) {
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

function hasExcelMetadataChanged(existing, incoming) {
  if (!existing) return true;
  const fields = [
    "batchCode",
    "expectedStudents",
    "startDate",
    "trackName",
    "coordinatorName",
    "coordinatorEmail",
    "day",
    "time",
    "zoomLink",
    "whatsappLink",
    "tableLink",
    "coachName",
    "coachPhone",
  ];
  return fields.some((f) => (existing[f] ?? "") !== (incoming[f] ?? ""));
}

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

function SidebarContent({ page, onPageChange, user, role, onClose }) {
  const roleLabels = {
    lead: "Operations Lead",
    project_manager: "Project Manager",
    coordinator: "Coordinator",
  };

  return (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="flex items-center justify-between pb-6 pt-2 px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#483BFF] text-white shadow-md shadow-[#483BFF]/25">
              <LayoutDashboard size={21} />
            </div>
            <div>
              <strong className="block text-base font-bold text-white tracking-tight">
                Coaching Ops
              </strong>
              <span className="block text-xs text-slate-400">
                {roleLabels[role] || "Portal"}
              </span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="space-y-1.5 pt-2" aria-label="Main navigation">
          {NAV_ITEMS.filter((item) => item.roles.includes(role)).map(
            ({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                  page === id
                    ? "bg-[#483BFF] text-white shadow-sm shadow-[#483BFF]/30"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
                onClick={() => {
                  onPageChange(id);
                  if (onClose) onClose();
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ),
          )}
        </nav>
      </div>

      <div className="border-t border-slate-800/80 pt-4">
        <div className="mb-2 px-2">
          <span className="block truncate text-xs text-slate-400 font-mono" title={user.email || ""}>
            {user.email}
          </span>
          <span className="inline-block mt-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            {role}
          </span>
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
          onClick={() => signOut(auth)}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
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
    <div className="grid min-h-screen place-items-center bg-[#F8F9FC] p-4 text-slate-900">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-xl shadow-slate-200/50"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#F0EFFF] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#483BFF]">
          <Sparkles size={13} />
          <span>Coaching Operations</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your assigned coaching operations account.
        </p>

        <label className="mt-6 block text-sm font-semibold text-slate-700">
          Work Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="coordinator@coaching-ops.com"
            className={INPUT}
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={INPUT}
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${PRIMARY_BUTTON} mt-6 w-full py-3`}
        >
          {loading ? "Signing in..." : "Sign in to Dashboard"}
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadGroupMap, setUnreadGroupMap] = useState(new Map());
  const [importReport, setImportReport] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );

  const role = profile?.role;
  const isLead = role === "lead";
  const isProjectManager = role === "project_manager";
  const isCoordinator = role === "coordinator";
  const canViewDashboard = isLead || isProjectManager;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 1024);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    setUnreadGroupMap(new Map());

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

  function handleSelectGroupFromNotification(code) {
    setGroupDay("all");
    setGroupSearch("");
    setSelectedCode(code);
    setPage("groups");
  }

  // Enhanced Excel Import implementation
  async function importFiles(event) {
    event.preventDefault();
    if (!isLead || importing || generating) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("groupsFile");

    setError("");
    setNotice("");
    setImporting(true);

    try {
      // Parse workbook using the upgraded engine
      const {
        groups: importedGroups,
        students: importedStudents,
        skippedGroups,
        invalidRows,
      } = await readWorkbook(file);

      // Validate workbook groups
      const incomingGroupMap = new Map();
      for (const group of importedGroups) {
        if (incomingGroupMap.has(group.groupCode)) {
          // Merge metadata if duplicate code across tabs, or retain first
          const existingMerged = incomingGroupMap.get(group.groupCode);
          incomingGroupMap.set(group.groupCode, {
            ...existingMerged,
            ...group,
          });
        } else {
          incomingGroupMap.set(group.groupCode, group);
        }
      }

      // Fetch current Firestore state
      const [
        existingGroupsSnap,
        existingStudentsSnap,
        existingSessionsSnap,
        existingUsersSnap,
        existingNotificationsSnap,
        existingCredentialsSnap,
      ] = await Promise.all([
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "students")),
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "notifications")),
        getDocs(collection(db, "zoomCredentials")),
      ]);

      const existingGroupMap = new Map(
        existingGroupsSnap.docs.map((d) => [d.data().groupCode, { id: d.id, ...d.data() }]),
      );

      const existingCredentialsMap = new Map(
        existingCredentialsSnap.docs.map((d) => [d.data().groupCode, { id: d.id, ...d.data() }]),
      );

      const existingSessionIds = new Set(
        existingSessionsSnap.docs.map((item) => item.id),
      );

      const existingStudentsByKey = new Map(
        existingStudentsSnap.docs.map((d) => {
          const st = d.data();
          return [studentKey(st), { id: d.id, ...st }];
        }),
      );

      const usersByEmail = new Map(
        existingUsersSnap.docs.map((d) => [
          (d.data().email || "").toLowerCase(),
          d.id,
        ]),
      );

      const operations = [];
      let createdGroups = 0;
      let updatedGroups = 0;
      let unchangedGroups = 0;
      let newSessions = 0;
      let reassignedSessions = 0;
      let createdStudents = 0;
      let updatedStudents = 0;
      let unchangedStudents = 0;
      let notificationsCreated = 0;

      // 1. Process Groups
      for (const group of incomingGroupMap.values()) {
        const { zoomUserId, zoomPassword, sheetName, excelRow, ...publicGroup } = group;
        const groupId = documentId(group.groupCode);
        const existingGroup = existingGroupMap.get(group.groupCode);

        if (!existingGroup) {
          // Genuinely new group
          operations.push({
            collectionName: "groups",
            id: groupId,
            data: {
              ...publicGroup,
              assignmentCount: 1,
              lastAssignedCoordinatorEmail: group.coordinatorEmail || "",
              createdAt: serverTimestamp(),
            },
          });
          createdGroups += 1;

          if (zoomUserId || zoomPassword) {
            operations.push({
              collectionName: "zoomCredentials",
              id: groupId,
              data: {
                groupCode: group.groupCode,
                coordinatorEmail: group.coordinatorEmail || "",
                zoomUserId: zoomUserId || "",
                zoomPassword: zoomPassword || "",
              },
            });
          }

          // Create 10 weekly sessions
          for (const operation of sessionOperations(publicGroup)) {
            operations.push(operation);
            newSessions += 1;
          }

          // Deterministic notification for initial assignment (#1)
          if (group.coordinatorEmail) {
            operations.push({
              collectionName: "notifications",
              id: documentId(`notif:${group.groupCode}:assign:1`),
              data: {
                recipientEmail: group.coordinatorEmail,
                recipientUid: usersByEmail.get(group.coordinatorEmail) || null,
                groupCode: group.groupCode,
                type: "assignment",
                assignmentIndex: 1,
                title: "New Group Assigned",
                message: `Group ${group.groupCode} (${group.trackName || "Coaching"}) has been assigned to you.`,
                groupId,
                trackName: group.trackName || "",
                coachName: group.coachName || "",
                day: group.day || "",
                time: group.time || "",
                startDate: group.startDate || "",
                read: false,
                createdAt: serverTimestamp(),
              },
            });
            notificationsCreated += 1;
          }
        } else {
          // Existing group: check if coordinator changed or metadata updated
          const isCoordinatorChanged = Boolean(
            group.coordinatorEmail &&
            existingGroup.coordinatorEmail &&
            existingGroup.coordinatorEmail.toLowerCase() !== group.coordinatorEmail.toLowerCase()
          );

          const isMetadataChanged = hasExcelMetadataChanged(existingGroup, group);

          if (isCoordinatorChanged) {
            const nextAssignmentCount = (existingGroup.assignmentCount || 1) + 1;
            operations.push({
              collectionName: "groups",
              id: groupId,
              data: {
                ...publicGroup,
                assignmentCount: nextAssignmentCount,
                lastAssignedCoordinatorEmail: group.coordinatorEmail,
                updatedAt: serverTimestamp(),
              },
            });
            updatedGroups += 1;

            // Deterministic notification for this specific reassignment event
            operations.push({
              collectionName: "notifications",
              id: documentId(`notif:${group.groupCode}:assign:${nextAssignmentCount}`),
              data: {
                recipientEmail: group.coordinatorEmail,
                recipientUid: usersByEmail.get(group.coordinatorEmail) || null,
                groupCode: group.groupCode,
                type: "reassignment",
                assignmentIndex: nextAssignmentCount,
                title: "Group Reassigned",
                message: `Group ${group.groupCode} (${group.trackName || "Coaching"}) has been reassigned to you.`,
                groupId,
                trackName: group.trackName || "",
                coachName: group.coachName || "",
                day: group.day || "",
                time: group.time || "",
                startDate: group.startDate || "",
                read: false,
                createdAt: serverTimestamp(),
              },
            });
            notificationsCreated += 1;

            // Synchronize Zoom credentials access to the new coordinator!
            if (existingCredentialsMap.has(group.groupCode) || zoomUserId || zoomPassword) {
              operations.push({
                collectionName: "zoomCredentials",
                id: groupId,
                data: {
                  groupCode: group.groupCode,
                  coordinatorEmail: group.coordinatorEmail || "",
                  ...(zoomUserId ? { zoomUserId } : {}),
                  ...(zoomPassword ? { zoomPassword } : {}),
                },
              });
            }
          } else if (isMetadataChanged) {
            operations.push({
              collectionName: "groups",
              id: groupId,
              data: {
                ...publicGroup,
                updatedAt: serverTimestamp(),
              },
            });
            updatedGroups += 1;

            if (zoomUserId || zoomPassword) {
              operations.push({
                collectionName: "zoomCredentials",
                id: groupId,
                data: {
                  groupCode: group.groupCode,
                  coordinatorEmail: group.coordinatorEmail || "",
                  zoomUserId: zoomUserId || "",
                  zoomPassword: zoomPassword || "",
                },
              });
            }
          } else {
            unchangedGroups += 1;
          }

          // Create ONLY missing sessions for existing group (never overwrite existing)
          for (const operation of sessionOperations(publicGroup)) {
            if (!existingSessionIds.has(operation.id)) {
              operations.push(operation);
              newSessions += 1;
            }
          }
        }
      }

      // 2. Synchronize Existing Sessions for reassigned groups
      for (const snapshot of existingSessionsSnap.docs) {
        const session = snapshot.data();
        const incomingGroup = incomingGroupMap.get(session.groupCode);

        if (
          incomingGroup &&
          incomingGroup.coordinatorEmail &&
          (session.coordinatorEmail || "").toLowerCase() !== incomingGroup.coordinatorEmail.toLowerCase()
        ) {
          operations.push({
            collectionName: "sessions",
            id: snapshot.id,
            data: {
              coordinatorEmail: incomingGroup.coordinatorEmail,
              coordinatorName: incomingGroup.coordinatorName,
            },
          });
          reassignedSessions += 1;
        }
      }

      // 3. Process Students from Workbook
      for (const st of importedStudents) {
        const key = studentKey(st);
        const existingStudent = existingStudentsByKey.get(key);
        const parentGroup = incomingGroupMap.get(st.groupCode);
        const coordinatorEmail =
          parentGroup?.coordinatorEmail || st.coordinatorEmail || "";

        if (!existingStudent) {
          // New student
          operations.push({
            collectionName: "students",
            id: documentId(key),
            data: {
              groupCode: st.groupCode,
              userId: st.userId || "",
              name: st.name || "Unnamed",
              mobile: st.mobile || "",
              email: st.email || "",
              gender: st.gender || "",
              studentType: st.studentType || "",
              moduleName: st.moduleName || "",
              batch: st.batch || "",
              status: "لم يُرسل",
              coordinatorEmail,
              createdAt: serverTimestamp(),
            },
          });
          createdStudents += 1;
        } else if (hasStudentChanged(existingStudent, st, coordinatorEmail)) {
          // Existing student with changed fields: PRESERVE operational status!
          operations.push({
            collectionName: "students",
            id: existingStudent.id,
            data: {
              name: st.name || existingStudent.name,
              mobile: st.mobile || existingStudent.mobile,
              email: st.email || existingStudent.email,
              gender: st.gender || existingStudent.gender,
              studentType: st.studentType || existingStudent.studentType,
              moduleName: st.moduleName || existingStudent.moduleName,
              batch: st.batch || existingStudent.batch,
              coordinatorEmail,
              updatedAt: serverTimestamp(),
            },
          });
          updatedStudents += 1;
        } else {
          unchangedStudents += 1;
        }
      }

      // Also ensure any existing students in Firestore get coordinatorEmail updated if group was reassigned
      for (const snapshot of existingStudentsSnap.docs) {
        const student = snapshot.data();
        const incomingGroup = incomingGroupMap.get(student.groupCode);

        if (
          incomingGroup &&
          incomingGroup.coordinatorEmail &&
          (student.coordinatorEmail || "").toLowerCase() !== incomingGroup.coordinatorEmail.toLowerCase()
        ) {
          const alreadyQueued = operations.some(
            (op) => op.collectionName === "students" && op.id === snapshot.id,
          );
          if (!alreadyQueued) {
            operations.push({
              collectionName: "students",
              id: snapshot.id,
              data: {
                coordinatorEmail: incomingGroup.coordinatorEmail,
              },
            });
            updatedStudents += 1;
          }
        }
      }

      // Execute batch writes safely
      await commitOperations(operations);
      formElement.reset();

      // Show comprehensive results report modal
      setImportReport({
        createdGroups,
        updatedGroups,
        unchangedGroups,
        skippedGroups,
        createdStudents,
        updatedStudents,
        unchangedStudents,
        invalidRows,
        newSessions,
        reassignedSessions,
        notificationsCreated,
      });

      setNotice(
        `Import complete: ${createdGroups} new groups created, ${updatedGroups} updated, ${unchangedGroups} unchanged, ${skippedGroups.length} unassigned groups skipped. All student progress and session attendance were preserved.`,
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
      // Query existing sessions from Firestore to ensure existing sessions are NEVER overwritten!
      const existingSessionsSnap = await getDocs(collection(db, "sessions"));
      const existingSessionIds = new Set(
        existingSessionsSnap.docs.map((item) => item.id),
      );

      const operations = [];
      for (const group of groups) {
        try {
          const groupSessions = sessionOperations(group);
          for (const op of groupSessions) {
            if (!existingSessionIds.has(op.id)) {
              operations.push(op);
            }
          }
        } catch (err) {
          throw new Error(`Group "${group.groupCode}": ${err.message}`);
        }
      }

      if (operations.length === 0) {
        setNotice(
          "All group sessions are already up to date. Existing scheduled dates, times, overrides, attendance, and notes were preserved.",
        );
      } else {
        await commitOperations(operations);
        setNotice(
          `Created ${operations.length} missing sessions. All existing sessions, scheduled dates, overrides, attendance, and notes were preserved.`,
        );
      }
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
      <div className="grid min-h-screen place-items-center bg-[#F8F9FC] text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#483BFF] border-t-transparent" />
          <span className="text-sm font-semibold text-slate-500">Loading Coaching Ops...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  if (!profile || !["lead", "project_manager", "coordinator"].includes(role)) {
    return (
      <div className="mx-auto mt-24 max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Account awaiting activation</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your account needs an assigned role in Firebase.
        </p>
        <code className="mt-4 block break-all rounded-xl bg-slate-100 p-3 text-xs text-slate-700 font-mono">
          {user.uid}
        </code>
        {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}
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
    sessions: "Sessions Management",
    import: "Import Excel Database",
  };

  const descriptions = {
    dashboard: "Monitor group membership, coordinator workload, and sessions overview.",
    groups: "Search and manage assigned groups, student communications, and statuses.",
    sessions: "Manage weekly coaching sessions, Zoom host access, and record attendance.",
    import: "Synchronize groups and students safely from Excel workbook tabs.",
  };

  return (
    <div className="app-layout">
      {/* Desktop Persistent Sidebar — strictly rendered only on desktop (>= 1024px) */}
      {isDesktop && (
        <aside className="app-sidebar">
          <SidebarContent
            page={page}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setNotice("");
            }}
            user={user}
            role={role}
          />
        </aside>
      )}

      {/* Mobile Slide-Out Drawer Navigation — strictly rendered only on mobile/tablet */}
      {!isDesktop && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#171828] shadow-2xl">
            <SidebarContent
              page={page}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                setNotice("");
              }}
              user={user}
              role={role}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="app-main flex-1 w-full min-w-0">
        {/* Top Navbar */}
        <header className="app-topbar sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 py-2.5 backdrop-blur-md sm:px-6 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
              aria-label="Open menu"
            >
              <Menu size={19} />
            </button>

            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#483BFF] truncate">
                NTI · Creative i-Lance
              </p>
              <h1 className="text-sm font-bold text-slate-900 sm:text-lg truncate">
                {headings[page]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Cairo Date Badge */}
            <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
              <Calendar size={14} className="text-[#483BFF]" />
              <span>{dateLabel(today)}</span>
              <span className="text-[10px] text-slate-400 font-normal">· Cairo</span>
            </div>

            {/* Notification Center */}
            <NotificationCenter
              user={user}
              role={role}
              onSelectGroup={handleSelectGroupFromNotification}
              onUnreadMapChange={setUnreadGroupMap}
              onError={setError}
            />

            {/* User role pill */}
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 md:block">
              <span className="text-slate-400 mr-1.5 font-normal">Role:</span>
              <span className="text-[#483BFF]">{role}</span>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="app-content p-4 sm:p-6 lg:p-8">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-xs"
            >
              <div className="mt-0.5 rounded-full bg-rose-100 p-1 text-rose-600">
                <X size={14} />
              </div>
              <div className="flex-1 break-words">{error}</div>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-500 hover:text-rose-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-xs"
            >
              <div className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-600">
                <Check size={14} />
              </div>
              <div className="flex-1 break-words">{notice}</div>
              <button
                type="button"
                onClick={() => setNotice("")}
                className="text-emerald-500 hover:text-emerald-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* DASHBOARD PAGE */}
          {canViewDashboard && page === "dashboard" && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Today's sessions", sessionSummary.today, Clock],
                  ["Upcoming scheduled sessions", sessionSummary.upcoming, CalendarDays],
                  ["Completed sessions", sessionSummary.completed, CheckCircle2],
                  ["Recorded attendance total", sessionSummary.attendance, UsersRound],
                ].map(([label, count, Icon]) => (
                  <div key={label} className={CARD_CLASS}>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {label}
                      </span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0EFFF] text-[#483BFF]">
                        <Icon size={18} />
                      </div>
                    </div>
                    <strong className="mt-3 block text-3xl font-extrabold text-[#483BFF] tracking-tight">
                      {count}
                    </strong>
                  </div>
                ))}
              </div>

              <OperationsDashboard
                groups={groups}
                students={students}
                mode={isProjectManager ? "project_manager" : "operations"}
              />
            </>
          )}

          {/* SESSIONS PAGE */}
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
                      : "Generate / Sync Group Sessions"}
                  </button>
                  <span className="text-xs text-slate-500">
                    Creates 10 weekly sessions per group safely without overwriting edits.
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

          {/* IMPORT EXCEL PAGE */}
          {isLead && page === "import" && (
            <section className={CARD_CLASS}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0EFFF] text-[#483BFF]">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Import & Synchronize Groups Database
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Upload an Excel workbook containing sheets such as{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                      Old Students Coashing
                    </code>{" "}
                    and{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                      New Students Coashing
                    </code>
                    .
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 text-xs text-slate-600 sm:grid-cols-3">
                <div>
                  <strong className="block font-semibold text-slate-900 mb-1">
                    1. Assigned Groups Only
                  </strong>
                  Groups with an assigned coordinator are safely imported or updated. Groups without a coordinator are skipped.
                </div>
                <div>
                  <strong className="block font-semibold text-slate-900 mb-1">
                    2. Data Safety Guaranteed
                  </strong>
                  Existing student statuses, session attendance, notes, and rescheduled dates are 100% preserved.
                </div>
                <div>
                  <strong className="block font-semibold text-slate-900 mb-1">
                    3. Coordinator Notifications
                  </strong>
                  When new groups or reassignments occur, the assigned coordinator receives an in-app notification.
                </div>
              </div>

              <form onSubmit={importFiles} className="mt-6 flex flex-wrap items-end gap-4">
                <label className="block min-w-0 flex-1 text-sm font-semibold text-slate-700">
                  Choose Excel Workbook (.xlsx, .xls)
                  <input
                    name="groupsFile"
                    type="file"
                    accept=".xlsx,.xls"
                    required
                    className="mt-2 block w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#F0EFFF] file:px-4 file:py-2.5 file:font-semibold file:text-[#483BFF] hover:file:bg-[#E4E1FF] cursor-pointer"
                  />
                </label>

                <button
                  type="submit"
                  disabled={importing || generating}
                  className={`${PRIMARY_BUTTON} py-2.5 px-6`}
                >
                  {importing ? "Importing & Syncing..." : "Start Import"}
                </button>
              </form>
            </section>
          )}

          {/* GROUPS MANAGEMENT PAGE */}
          {page === "groups" && (
            <>
              {/* Filter Bar */}
              <div className="mb-6 grid min-w-0 gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
                <label className="min-w-0 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Day Filter
                  <select
                    value={groupDay}
                    onChange={(event) => {
                      setGroupDay(event.target.value);
                      setSelectedCode("");
                    }}
                    className={INPUT}
                  >
                    <option value="all">All Days</option>
                    {availableDays.map((day) => (
                      <option key={day}>{day}</option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Group
                  <select
                    value={selectedGroup?.groupCode || ""}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    className={INPUT}
                  >
                    {!filteredGroups.length && (
                      <option value="">No matching groups</option>
                    )}
                    {filteredGroups.map((group) => {
                      const isUnread = unreadGroupMap.has(group.groupCode);
                      return (
                        <option key={group.id || group.groupCode} value={group.groupCode}>
                          {isUnread ? "★ [NEW] " : ""}
                          {group.groupCode}
                          {group.coordinatorName
                            ? ` — ${group.coordinatorName}`
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold uppercase tracking-wider text-slate-600 sm:col-span-2 lg:col-span-1">
                  Search
                  <span className="relative block">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={groupSearch}
                      onChange={(event) => {
                        setGroupSearch(event.target.value);
                        setSelectedCode("");
                      }}
                      placeholder="Group, student, phone, coach..."
                      className={`${INPUT} pl-10`}
                    />
                  </span>
                </label>
              </div>

              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
                <span>
                  Showing {filteredGroups.length} accessible groups ·{" "}
                  {groupStudents.length} students in selected group
                </span>
                {selectedGroup && unreadGroupMap.has(selectedGroup.groupCode) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#483BFF] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                    <Sparkles size={12} />
                    New Assignment
                  </span>
                )}
              </div>

              {!selectedGroup ? (
                <section className={CARD_CLASS}>
                  <p className="text-center py-8 text-sm text-slate-500">
                    No groups match your search criteria.
                  </p>
                </section>
              ) : (
                <>
                  {/* Group Overview Card */}
                  <section className={`${CARD_CLASS} mb-6`}>
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-[#483BFF]">
                            Group Overview
                          </p>
                          {unreadGroupMap.has(selectedGroup.groupCode) && (
                            <span className="rounded-md bg-[#483BFF] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white animate-pulse">
                              NEW
                            </span>
                          )}
                        </div>

                        <h2 className="mt-1 text-2xl font-extrabold text-slate-900 break-words tracking-tight">
                          {selectedGroup.groupCode}
                        </h2>

                        <p className="text-sm font-medium text-slate-500">
                          {selectedGroup.trackName || "Track Not Specified"}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full bg-[#F0EFFF] px-4 py-2 text-sm font-bold text-[#3729E6]">
                        <CheckCircle2 size={16} />
                        {
                          groupStudents.filter(
                            (student) => student.status === JOINED_STATUS,
                          ).length
                        }{" "}
                        / {groupStudents.length} joined
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        ["Coordinator", selectedGroup.coordinatorName],
                        ["Coach", selectedGroup.coachName],
                        ["Scheduled Day", selectedGroup.day],
                        ["Start Date", selectedGroup.startDate],
                        ["Time", selectedGroup.time],
                      ].map(([label, val]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5"
                        >
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </span>
                          <strong className="mt-1 block text-sm font-semibold text-slate-800 break-words">
                            {val || "—"}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {/* Operational Quick Links */}
                    <div className="mt-5 flex flex-wrap gap-2.5 text-xs sm:text-sm font-semibold text-[#483BFF]">
                      {[
                        ["Open Zoom Link", selectedGroup.zoomLink],
                        ["Open WhatsApp Group", selectedGroup.whatsappLink],
                        ["Open Students Sheet", selectedGroup.tableLink],
                      ]
                        .filter(([, link]) => link)
                        .map(([label, link]) => (
                          <a
                            key={label}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <span className="truncate">{label}</span>
                            <ExternalLink size={14} className="shrink-0 text-[#483BFF]" />
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
                        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          Student count mismatch: {selectedGroup.expectedStudents}{" "}
                          expected, {groupStudents.length} imported.
                        </p>
                      )}
                  </section>

                  {/* Student Communication Template */}
                  <section className={`${CARD_CLASS} mb-6`}>
                    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Welcome WhatsApp Message
                        </h2>
                        <p className="text-xs text-slate-500">
                          Copy or customize message to send to students.
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`${SECONDARY_BUTTON} min-h-[44px] w-full sm:w-auto`}
                        onClick={() => copyText(message)}
                      >
                        <Copy size={15} />
                        <span>Copy student message</span>
                      </button>
                    </div>

                    <textarea
                      dir="rtl"
                      rows={8}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      className="block w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 text-sm leading-7 text-slate-800 outline-none focus:border-[#483BFF] focus:bg-white focus:ring-2 focus:ring-[#483BFF]/20"
                    />

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        className={`${SECONDARY_BUTTON} min-h-[44px] w-full sm:w-auto`}
                        onClick={() => copyText(coachMessage(selectedGroup))}
                      >
                        <Copy size={15} />
                        <span>Copy coach message</span>
                      </button>

                      {formatPhone(selectedGroup.coachPhone) &&
                        selectedGroup.whatsappLink && (
                          <a
                            className={`${PRIMARY_BUTTON} min-h-[44px] w-full sm:w-auto`}
                            href={whatsappUrl(
                              selectedGroup.coachPhone,
                              coachMessage(selectedGroup),
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={16} />
                            <span>Message Coach via WhatsApp</span>
                          </a>
                        )}
                    </div>
                  </section>

                  {/* Students Roster */}
                  <section className={CARD_CLASS}>
                    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Group Students ({filteredStudents.length})
                        </h2>
                        <p className="text-xs text-slate-500">
                          Update status after communicating and confirming group entry.
                        </p>
                      </div>

                      <input
                        type="search"
                        placeholder="Search student by name, phone, ID..."
                        value={studentSearch}
                        onChange={(event) =>
                          setStudentSearch(event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-[#483BFF] sm:w-72"
                      />
                    </div>

                    {/* Mobile Students Cards (< 768px) */}
                    <div className="space-y-3 md:hidden">
                      {filteredStudents.map((student) => (
                        <div
                          key={student.id}
                          className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <strong className="block text-sm font-bold text-slate-900 break-words">
                                {student.name || "Unnamed Student"}
                              </strong>
                              <span className="block text-xs font-mono text-slate-400 mt-0.5">
                                {student.userId || "—"}
                              </span>
                            </div>
                            {student.mobile && (
                              <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                                {student.mobile}
                              </span>
                            )}
                          </div>

                          <div className="mt-3">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Status
                            </label>
                            {isProjectManager ? (
                              <span className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
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
                                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
                              >
                                {STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {STATUS_LABELS[status] || status}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100">
                            {formatPhone(student.mobile) &&
                            selectedGroup.whatsappLink ? (
                              <a
                                className={`${PRIMARY_BUTTON} w-full min-h-[44px] py-2.5 px-4 text-xs`}
                                href={whatsappUrl(student.mobile, message)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle size={15} />
                                <span>Send WhatsApp Template</span>
                              </a>
                            ) : (
                              <span className="block text-center text-xs text-amber-700 bg-amber-50 rounded-lg py-2.5 px-3 border border-amber-100">
                                Missing phone or group link
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {!filteredStudents.length && (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                          No students found.
                        </div>
                      )}
                    </div>

                    {/* Desktop Students Table (>= 768px) */}
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            {["Student", "Phone", "Status", "Quick WhatsApp"].map(
                              (heading) => (
                                <th key={heading} className="px-4 py-3">
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {filteredStudents.map((student) => (
                            <tr
                              key={student.id}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <strong className="block text-slate-900 break-words">
                                  {student.name || "Unnamed Student"}
                                </strong>
                                <span className="text-xs text-slate-400 font-mono">
                                  {student.userId || "—"}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                {student.mobile || "—"}
                              </td>

                              <td className="px-4 py-3">
                                {isProjectManager ? (
                                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
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
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-[#483BFF]"
                                  >
                                    {STATUSES.map((status) => (
                                      <option key={status} value={status}>
                                        {STATUS_LABELS[status] || status}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {formatPhone(student.mobile) &&
                                selectedGroup.whatsappLink ? (
                                  <a
                                    className={`${PRIMARY_BUTTON} py-1.5 px-3 text-xs`}
                                    href={whatsappUrl(student.mobile, message)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MessageCircle size={14} />
                                    <span>Send Template</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-amber-700">
                                    Missing phone or group link
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}

                          {!filteredStudents.length && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-8 text-center text-sm text-slate-400"
                              >
                                No students found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 1024px) */}
      {!isDesktop && (
        <nav className="mobile-bottom-nav lg:hidden" aria-label="Mobile Navigation">
          {NAV_ITEMS.filter((item) => item.roles.includes(role)).map(
            ({ id, label, icon: Icon }) => {
              const isActive = page === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPage(id);
                    setNotice("");
                  }}
                  className={`mobile-bottom-nav-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="mobile-nav-icon-wrap">
                    <Icon size={19} />
                  </span>
                  <span className="truncate max-w-[64px]">{label}</span>
                </button>
              );
            },
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="mobile-bottom-nav-item"
            aria-label="Open full menu and profile"
          >
            <span className="mobile-nav-icon-wrap">
              <Menu size={19} />
            </span>
            <span>More</span>
          </button>
        </nav>
      )}

      {/* Import Results Report Modal */}
      {importReport && (
        <ImportReport
          report={importReport}
          onClose={() => setImportReport(null)}
        />
      )}
    </div>
  );
}
