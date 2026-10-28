import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Search,
} from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "./firebase";
import { cairoToday, dateLabel } from "./importExcel";

const INPUT =
  "mt-1.5 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition-all focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20";

const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#483BFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#3729E6] active:scale-[0.99] disabled:opacity-50 transition-all";

const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F0EFFF] px-4 py-2 text-sm font-semibold text-[#3729E6] hover:bg-[#E4E1FF] active:scale-[0.99] transition-all";

const SESSION_STATUSES = ["Scheduled", "In progress", "Completed", "Cancelled"];

const STATUS_COLORS = {
  Scheduled: "bg-blue-50 text-blue-700 border border-blue-200",
  "In progress": "bg-amber-50 text-amber-700 border border-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Cancelled: "bg-rose-50 text-rose-700 border border-rose-200",
};

export function sessionDate(session) {
  return session.overrideDate || session.scheduledDate || "";
}

export function ZoomCredentials({ credentials, onError }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setVisible(false);
    setCopied("");
  }, [credentials?.groupCode, credentials?.zoomPassword]);

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${label} copied.`);
    } catch {
      onError("Could not copy. Please copy the value manually.");
    }
  }

  if (!credentials?.zoomUserId && !credentials?.zoomPassword) {
    return (
      <p className="mt-4 text-xs text-slate-500">
        Zoom login details have not been imported for this group.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-100 bg-[#F0EFFF] p-4">
      <p className="text-sm font-bold text-[#3729E6]">Zoom host account</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <span className="text-xs text-slate-500">Zoom User ID</span>

          <div className="mt-1 flex items-center gap-2">
            <span className="break-all text-sm">
              {credentials.zoomUserId || "—"}
            </span>

            {credentials.zoomUserId && (
              <button
                type="button"
                title="Copy Zoom User ID"
                aria-label="Copy Zoom User ID"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-100 shrink-0 transition-colors"
                onClick={() => copy(credentials.zoomUserId, "User ID")}
              >
                <Copy size={15} />
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs text-slate-500">Password</span>

          <div className="mt-1 flex items-center gap-2">
            <span className="break-all font-mono text-sm">
              {credentials.zoomPassword
                ? visible
                  ? credentials.zoomPassword
                  : "••••••••••"
                : "—"}
            </span>

            {credentials.zoomPassword && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  title={visible ? "Hide password" : "Show password"}
                  aria-label={visible ? "Hide password" : "Show password"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                  onClick={() => setVisible((current) => !current)}
                >
                  {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>

                <button
                  type="button"
                  title="Copy password"
                  aria-label="Copy password"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                  onClick={() => copy(credentials.zoomPassword, "Password")}
                >
                  <Copy size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {copied && (
        <p role="status" className="mt-2 text-xs text-emerald-700">
          {copied}
        </p>
      )}
    </div>
  );
}

function SessionCard({ session, group, credentials, user, role, onError }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveDate = sessionDate(session);
  const effectiveTime = session.overrideTime || session.time || group?.time;
  const canEdit = role === "lead" || role === "coordinator";
  const status = session.status || "Scheduled";

  async function save(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const attendanceText = String(form.get("attendance") ?? "").trim();
    const attendanceCount =
      attendanceText === "" ? null : Number(attendanceText);

    if (
      attendanceCount !== null &&
      (!Number.isInteger(attendanceCount) || attendanceCount < 0)
    ) {
      onError("Attendance must be a whole number of zero or more.");
      return;
    }

    setSaving(true);
    onError("");

    try {
      const data = {
        status: String(form.get("status")),
        attendanceCount,
        notes: String(form.get("notes") || "").trim(),
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (canEdit) {
        const dateInput = form.get("date");
        const timeInput = form.get("time");

        if (dateInput !== null) {
          const chosenDate = String(dateInput);
          data.overrideDate =
            chosenDate === session.scheduledDate ? "" : chosenDate;
        }

        if (timeInput !== null) {
          const chosenTime = String(timeInput || "").trim();
          data.overrideTime =
            chosenTime === (session.time || group?.time || "") ? "" : chosenTime;
        }
      }

      await updateDoc(doc(db, "sessions", session.id), data);
      setEditing(false);
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="session-card rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#483BFF]">
            Session {session.sessionNumber} / 10
          </p>

          <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 break-words">{session.groupCode}</h2>

          <p className="text-xs font-medium text-slate-500 break-words">
            {group?.trackName || session.trackName || "—"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            STATUS_COLORS[status] || STATUS_COLORS.Scheduled
          }`}
        >
          {status}
        </span>
      </div>

      <div className="mt-4 grid gap-2.5 text-xs grid-cols-1 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</span>
          <strong className="mt-0.5 block text-sm font-semibold text-slate-800">{dateLabel(effectiveDate)}</strong>
          {session.overrideDate && (
            <span className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Rescheduled
            </span>
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Time</span>
          <strong className="mt-0.5 block text-sm font-semibold text-slate-800">{effectiveTime || "—"}</strong>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Coordinator</span>
          <strong className="mt-0.5 block text-sm font-semibold text-slate-800 break-words">
            {group?.coordinatorName || session.coordinatorName || "—"}
          </strong>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Coach</span>
          <strong className="mt-0.5 block text-sm font-semibold text-slate-800 break-words">
            {group?.coachName || session.coachName || "—"}
          </strong>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:col-span-2 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Recorded Attendance</span>
          <strong className="mt-0.5 block text-sm font-semibold text-slate-800">
            {session.attendanceCount != null ? `${session.attendanceCount} students attended` : "Not recorded yet"}
          </strong>
        </div>
      </div>

      {session.notes && (
        <p className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-700 break-words">
          {session.notes}
        </p>
      )}

      <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2.5">
        {(group?.zoomLink || session.zoomLink) && (
          <a
            className={`${BUTTON} min-h-[44px] flex-1 sm:flex-initial`}
            href={group?.zoomLink || session.zoomLink}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} />
            <span>Open Zoom</span>
          </a>
        )}

        {group?.whatsappLink && (
          <a
            className="inline-flex min-h-[44px] flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all"
            href={group.whatsappLink}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            <span>WhatsApp group</span>
          </a>
        )}

        {canEdit && (
          <button
            type="button"
            className={`${SECONDARY_BUTTON} min-h-[44px] w-full sm:w-auto`}
            onClick={() => setEditing((current) => !current)}
            disabled={saving}
          >
            {editing ? "Close editor" : "Update session"}
          </button>
        )}
      </div>

      {role !== "project_manager" && (
        <ZoomCredentials credentials={credentials} onError={onError} />
      )}

      {editing && (
        <form
          onSubmit={save}
          className="mt-5 space-y-4 border-t border-slate-100 pt-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Status
              <select
                name="status"
                defaultValue={status}
                className={INPUT}
                required
              >
                {SESSION_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Attendance count
              <input
                name="attendance"
                type="number"
                min="0"
                step="1"
                defaultValue={session.attendanceCount ?? ""}
                placeholder="Not recorded"
                className={INPUT}
              />
            </label>

            {canEdit && (
              <>
                <label className="text-sm font-medium">
                  Session date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={effectiveDate}
                    className={INPUT}
                  />
                </label>

                <label className="text-sm font-medium">
                  Time
                  <input
                    name="time"
                    required
                    defaultValue={effectiveTime || ""}
                    placeholder="7 PM - 10 PM"
                    className={INPUT}
                  />
                </label>
              </>
            )}
          </div>

          <label className="block text-sm font-medium">
            Notes
            <textarea
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={session.notes || ""}
              className={INPUT}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className={`${BUTTON} min-h-[44px] w-full sm:w-auto`}
          >
            <Save size={16} />
            <span>{saving ? "Saving..." : "Save changes"}</span>
          </button>
        </form>
      )}
    </article>
  );
}

export default function Sessions({
  sessions,
  groups,
  credentials,
  user,
  role,
  initialGroupCode = "all",
  onError,
}) {
  const [tab, setTab] = useState(initialGroupCode !== "all" ? "all" : "today");
  const [date, setDate] = useState("");
  const [groupCode, setGroupCode] = useState(initialGroupCode);
  const [coordinator, setCoordinator] = useState("all");
  const [day, setDay] = useState("all");
  const [search, setSearch] = useState("");
  const [today, setToday] = useState(cairoToday);

  useEffect(() => {
    if (initialGroupCode && initialGroupCode !== "all") {
      setGroupCode(initialGroupCode);
      setTab("all");
    }
  }, [initialGroupCode]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(cairoToday()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.groupCode, group])),
    [groups],
  );

  const credentialsMap = useMemo(
    () => new Map(credentials.map((item) => [item.groupCode, item])),
    [credentials],
  );

  const coordinators = useMemo(
    () =>
      [
        ...new Map(
          groups
            .filter((group) => group.coordinatorEmail)
            .map((group) => [
              group.coordinatorEmail,
              {
                email: group.coordinatorEmail,
                name: group.coordinatorName || group.coordinatorEmail,
              },
            ]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return sessions
      .filter((session) => {
        const sessionDay = sessionDate(session);
        const group = groupMap.get(session.groupCode);
        if (!sessionDay) return false;

        if (date) {
          if (sessionDay !== date) return false;
        } else {
          if (tab === "today" && sessionDay !== today) return false;
          if (tab === "upcoming" && sessionDay <= today) return false;
          if (tab === "previous" && sessionDay >= today) return false;
        }

        if (groupCode !== "all" && session.groupCode !== groupCode) {
          return false;
        }

        if (coordinator !== "all" && session.coordinatorEmail !== coordinator) {
          return false;
        }

        const weekday = new Date(`${sessionDay}T12:00:00Z`).getUTCDay();

        if (day !== "all" && String(weekday) !== day) return false;

        if (!term) return true;

        return [
          session.groupCode,
          session.sessionNumber,
          sessionDay,
          session.overrideTime || session.time,
          session.status || "Scheduled",
          session.attendanceCount,
          session.notes,
          group?.trackName || session.trackName,
          group?.coachName || session.coachName,
          group?.coordinatorName || session.coordinatorName,
          session.coordinatorEmail,
        ]
          .filter((item) => item !== null && item !== undefined)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort(
        (a, b) =>
          sessionDate(a).localeCompare(sessionDate(b)) ||
          a.groupCode.localeCompare(b.groupCode) ||
          a.sessionNumber - b.sessionNumber,
      );
  }, [
    sessions,
    groupMap,
    date,
    tab,
    today,
    groupCode,
    coordinator,
    day,
    search,
  ]);

  return (
    <section className="sessions-page">
      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar sm:flex-wrap sessions-tabs">
        {[
          ["today", "Today"],
          ["upcoming", "Upcoming"],
          ["previous", "Previous"],
          ["all", "All sessions"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setDate("");
            }}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all min-h-[44px] inline-flex items-center justify-center ${
              tab === id && !date
                ? "bg-[#483BFF] text-white shadow-sm shadow-[#483BFF]/30"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="sessions-filters mb-6 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={INPUT}
          />
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Day
          <select
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className={INPUT}
          >
            <option value="all">All days</option>
            {weekdays.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Group
          <select
            value={groupCode}
            onChange={(event) => setGroupCode(event.target.value)}
            className={INPUT}
          >
            <option value="all">All groups</option>
            {groups.map((group) => (
              <option key={group.id || group.groupCode} value={group.groupCode}>
                {group.groupCode}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Coordinator
          <select
            value={coordinator}
            onChange={(event) => setCoordinator(event.target.value)}
            className={INPUT}
          >
            <option value="all">All coordinators</option>
            {coordinators.map((item) => (
              <option key={item.email} value={item.email}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Search
          <span className="relative block">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Group, coach, status..."
              className={`${INPUT} pl-9`}
            />
          </span>
        </label>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={17} />
          {filtered.length} sessions
        </span>
        <span>Today: {dateLabel(today)} · Cairo time</span>
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No sessions match these filters.
        </div>
      ) : (
        <div className="sessions-cards grid gap-5">
          {filtered.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              group={groupMap.get(session.groupCode)}
              credentials={credentialsMap.get(session.groupCode)}
              user={user}
              role={role}
              onError={onError}
            />
          ))}
        </div>
      )}
    </section>
  );
}
