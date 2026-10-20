import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./operations-dashboard.css";

const JOINED_STATUS = "دخل الجروب";

function searchableText(group, groupStudents) {
  return [
    group.groupCode,
    group.trackName,
    group.coordinatorName,
    group.coordinatorEmail,
    group.coachName,
    group.coachPhone,
    group.day,
    group.startDate,
    group.time,
    ...groupStudents.flatMap((student) => [
      student.name,
      student.mobile,
      student.userId,
      student.status,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export default function OperationsDashboard({
  groups = [],
  students = [],
  mode = "operations",
}) {
  const [groupCode, setGroupCode] = useState("all");
  const [coordinator, setCoordinator] = useState("all");
  const [day, setDay] = useState("all");
  const [membership, setMembership] = useState("all");
  const [search, setSearch] = useState("");

  const isManager = mode === "project_manager";
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const coordinators = useMemo(
    () =>
      [
        ...new Set(
          groups.map((group) => group.coordinatorName).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [groups],
  );

  const days = useMemo(
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

  const visibleGroups = useMemo(
    () =>
      groups.filter((group) => {
        if (groupCode !== "all" && group.groupCode !== groupCode) return false;

        if (coordinator !== "all" && group.coordinatorName !== coordinator) {
          return false;
        }

        if (day !== "all" && group.day !== day) return false;

        if (
          normalizedSearch &&
          !searchableText(
            group,
            studentsByGroup.get(group.groupCode) || [],
          ).includes(normalizedSearch)
        ) {
          return false;
        }

        return true;
      }),
    [groups, groupCode, coordinator, day, normalizedSearch, studentsByGroup],
  );

  const visibleGroupCodes = useMemo(
    () => new Set(visibleGroups.map((group) => group.groupCode)),
    [visibleGroups],
  );

  const scopedStudents = useMemo(
    () =>
      students.filter((student) => visibleGroupCodes.has(student.groupCode)),
    [students, visibleGroupCodes],
  );

  const shownStudents = useMemo(
    () =>
      scopedStudents.filter((student) => {
        if (membership === "joined") {
          return student.status === JOINED_STATUS;
        }

        if (membership === "pending") {
          return student.status !== JOINED_STATUS;
        }

        return true;
      }),
    [scopedStudents, membership],
  );

  const joined = scopedStudents.filter(
    (student) => student.status === JOINED_STATUS,
  ).length;

  const pending = scopedStudents.length - joined;

  const membershipRate = scopedStudents.length
    ? Math.round((joined / scopedStudents.length) * 100)
    : 0;

  const groupRows = visibleGroups
    .map((group) => {
      const members = studentsByGroup.get(group.groupCode) || [];
      const groupJoined = members.filter(
        (student) => student.status === JOINED_STATUS,
      ).length;

      return {
        code: group.groupCode,
        coordinator: group.coordinatorName || "Unassigned",
        coach: group.coachName || "—",
        day: group.day || "—",
        total: members.length,
        joined: groupJoined,
        pending: members.length - groupJoined,
        rate: members.length
          ? Math.round((groupJoined / members.length) * 100)
          : 0,
      };
    })
    .sort((a, b) => b.pending - a.pending);

  const pieData = [
    { name: "Joined", value: joined, color: "#483BFF" },
    { name: "Pending", value: pending, color: "#CDC9FF" },
  ].filter((item) => item.value > 0);

  const coordinatorRows = coordinators
    .map((name) => {
      const assignedGroups = groupRows.filter(
        (group) => group.coordinator === name,
      );

      return {
        name,
        groups: assignedGroups.length,
        joined: assignedGroups.reduce(
          (total, group) => total + group.joined,
          0,
        ),
        pending: assignedGroups.reduce(
          (total, group) => total + group.pending,
          0,
        ),
      };
    })
    .filter((item) => item.groups > 0)
    .sort((a, b) => b.pending - a.pending);

  const groupsNeedingFollowUp = groupRows.filter(
    (group) => group.pending > 0,
  ).length;

  return (
    <section className="ops-dashboard" dir="ltr">
      <div className="ops-heading">
        <span className="ops-eyebrow">
          <BarChart3 size={16} />
          {isManager ? "PROJECT MANAGEMENT" : "OPERATIONS OVERVIEW"}
        </span>

        <h2>{isManager ? "Project Manager Dashboard" : "Groups Dashboard"}</h2>

        <p>
          {isManager
            ? "Monitor coordinator workload and groups requiring follow-up."
            : "Track group membership and student progress in real time."}
        </p>
      </div>

      <div className="ops-filters">
        <label>
          Group
          <select
            value={groupCode}
            onChange={(event) => setGroupCode(event.target.value)}
          >
            <option value="all">All groups</option>

            {groups.map((group) => (
              <option key={group.id || group.groupCode} value={group.groupCode}>
                {group.groupCode}
              </option>
            ))}
          </select>
        </label>

        <label>
          Coordinator
          <select
            value={coordinator}
            onChange={(event) => setCoordinator(event.target.value)}
          >
            <option value="all">All coordinators</option>

            {coordinators.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Day
          <select value={day} onChange={(event) => setDay(event.target.value)}>
            <option value="all">All days</option>

            {days.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Membership
          <select
            value={membership}
            onChange={(event) => setMembership(event.target.value)}
          >
            <option value="all">All students</option>
            <option value="joined">Joined</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <label className="ops-search-label">
          Search any data
          <span className="ops-search-field">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, phone, group, coach, status..."
            />
          </span>
        </label>
      </div>

      <div className="ops-stats">
        <Stat icon={UsersRound} label="Groups" value={visibleGroups.length} />

        <Stat
          icon={Users}
          label={membership === "all" ? "Students" : "Students shown"}
          value={shownStudents.length}
        />

        <Stat icon={CheckCircle2} label="Joined" value={joined} />

        <Stat
          icon={Clock3}
          label={isManager ? "Groups needing follow-up" : "Pending students"}
          value={isManager ? groupsNeedingFollowUp : pending}
        />
      </div>

      {isManager && (
        <div className="ops-panel" style={{ marginBottom: 16 }}>
          <div className="ops-panel-heading">
            <h3>Coordinator performance</h3>
            <span>Joined and pending students per coordinator</span>
          </div>

          {coordinatorRows.length ? (
            <div className="ops-chart-scroll">
              <div
                style={{
                  minWidth: 540,
                  height: Math.max(260, coordinatorRows.length * 48),
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={coordinatorRows}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#ECECF4" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={135}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="joined"
                      name="Joined"
                      stackId="students"
                      fill="#483BFF"
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending"
                      stackId="students"
                      fill="#CDC9FF"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="ops-empty">No coordinators match the filters.</p>
          )}
        </div>
      )}

      <div className="ops-charts">
        <div className="ops-panel">
          <div className="ops-panel-heading">
            <h3>Membership by group</h3>
            <span>Groups with the most pending students appear first</span>
          </div>

          {groupRows.length ? (
            <div className="ops-chart-scroll">
              <div
                style={{
                  minWidth: 540,
                  height: Math.max(290, groupRows.length * 45),
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={groupRows}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#ECECF4" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="code"
                      width={110}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="joined"
                      name="Joined"
                      stackId="students"
                      fill="#483BFF"
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending"
                      stackId="students"
                      fill="#CDC9FF"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="ops-empty">No groups match the filters.</p>
          )}
        </div>

        <div className="ops-panel">
          <div className="ops-panel-heading">
            <h3>Membership rate</h3>
            <span>Based on all students in the selected groups</span>
          </div>

          {scopedStudents.length ? (
            <>
              <div className="ops-pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {pieData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="ops-pie-label">
                  <strong>{membershipRate}%</strong>
                  <span>Joined</span>
                </div>
              </div>

              <div className="ops-legend">
                <span>
                  <i className="ops-dot ops-dot-joined" />
                  Joined: {joined}
                </span>
                <span>
                  <i className="ops-dot ops-dot-pending" />
                  Pending: {pending}
                </span>
              </div>
            </>
          ) : (
            <p className="ops-empty">No students in the selected groups.</p>
          )}
        </div>
      </div>

      <div className="ops-panel ops-table-panel">
        <div className="ops-panel-heading">
          <h3>Group progress</h3>
          <span>Membership and follow-up by group</span>
        </div>

        {/* Mobile View: High-usability cards without horizontal scrolling */}
        <div className="block sm:hidden space-y-2.5">
          {groupRows.map((group) => (
            <div key={group.code} className="ops-mobile-card">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm font-bold text-slate-900 break-words">{group.code}</strong>
                <span className="rounded-full bg-[#F0EFFF] px-2 py-0.5 text-xs font-bold text-[#3729E6]">
                  {group.rate}% joined
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span>{group.day}</span>
                <span>·</span>
                <span className="truncate max-w-[130px]">{group.coordinator}</span>
                {group.coach !== "—" && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[110px]">{group.coach}</span>
                  </>
                )}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700">{group.joined} Joined</span>
                <span className="text-amber-700">{group.pending} Pending</span>
                <span className="text-slate-400 font-normal">{group.total} Total</span>
              </div>
              <div className="ops-progress-bar-bg">
                <div
                  className="ops-progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, group.rate))}%` }}
                />
              </div>
            </div>
          ))}

          {!groupRows.length && (
            <p className="ops-empty">No data matches the filters.</p>
          )}
        </div>

        {/* Desktop View: Full data table with contained scroll */}
        <div className="hidden sm:block ops-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Day</th>
                <th>Coordinator</th>
                <th>Coach</th>
                <th>Students</th>
                <th>Joined</th>
                <th>Pending</th>
                <th>Rate</th>
              </tr>
            </thead>

            <tbody>
              {groupRows.map((group) => (
                <tr key={group.code}>
                  <td>
                    <strong>{group.code}</strong>
                  </td>
                  <td>{group.day}</td>
                  <td>{group.coordinator}</td>
                  <td>{group.coach}</td>
                  <td>{group.total}</td>
                  <td>{group.joined}</td>
                  <td>{group.pending}</td>
                  <td>{group.rate}%</td>
                </tr>
              ))}

              {!groupRows.length && (
                <tr>
                  <td colSpan={8}>No data matches the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="ops-stat">
      <div className="ops-stat-icon">
        <Icon size={20} />
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
