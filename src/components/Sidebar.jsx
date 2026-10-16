import {
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  UsersRound,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const items = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    leadOnly: true,
  },
  { id: "groups", label: "Groups", icon: UsersRound },
  {
    id: "import",
    label: "Import Excel",
    icon: FileSpreadsheet,
    leadOnly: true,
  },
];

export default function Sidebar({ page, onPageChange, user, isLead }) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <LayoutDashboard size={21} />
        </div>

        <div>
          <strong>Coaching Ops</strong>
          <span>{isLead ? "Operations Lead" : "Coordinator"}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {items
          .filter((item) => !item.leadOnly || isLead)
          .map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-link ${page === id ? "active" : ""}`}
              onClick={() => onPageChange(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-email" title={user.email}>
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
