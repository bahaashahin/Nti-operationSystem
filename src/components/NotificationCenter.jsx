import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Inbox,
  Sparkles,
  X,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

function timeAgo(date) {
  if (!date) return "";
  const now = new Date();
  const past = date instanceof Date ? date : new Date(date);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

export default function NotificationCenter({
  user,
  role,
  onSelectGroup,
  onUnreadMapChange,
  onError,
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [updating, setUpdating] = useState(false);
  const panelRef = useRef(null);

  const email = (user?.email || "").toLowerCase();

  // Listen to notifications real-time
  useEffect(() => {
    if (!user || !email) return;

    // Listen to notifications for this coordinator
    const q = query(
      collection(db, "notifications"),
      where("recipientEmail", "==", email),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdAtDate = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt
            ? new Date(data.createdAt)
            : new Date();

          return {
            id: docSnap.id,
            ...data,
            createdAtDate,
          };
        });

        // Sort latest first
        items.sort(
          (a, b) =>
            (b.createdAtDate?.getTime() || 0) -
            (a.createdAtDate?.getTime() || 0),
        );

        setNotifications(items);

        // Notify parent about unread groups for the "NEW" badge indicator
        if (onUnreadMapChange) {
          const unreadGroupMap = new Map();
          for (const item of items) {
            if (!item.read && item.groupCode) {
              unreadGroupMap.set(item.groupCode, true);
            }
          }
          onUnreadMapChange(unreadGroupMap);
        }
      },
      (err) => {
        if (onError) onError(err.message);
      },
    );

    return () => unsubscribe();
  }, [user, email, onUnreadMapChange, onError]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  async function markAsRead(notification, event) {
    if (event) event.stopPropagation();
    try {
      await updateDoc(doc(db, "notifications", notification.id), {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (err) {
      if (onError) onError(err.message);
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length || updating) return;

    setUpdating(true);
    try {
      const batch = writeBatch(db);
      for (const item of unread) {
        batch.update(doc(db, "notifications", item.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      if (onError) onError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  function handleOpenGroup(notification) {
    if (!notification.read) {
      markAsRead(notification);
    }
    setOpen(false);
    if (onSelectGroup && notification.groupCode) {
      onSelectGroup(notification.groupCode);
    }
  }

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        title="Notifications"
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 ${
          open
            ? "border-[#483BFF] bg-[#F0EFFF] text-[#483BFF]"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#483BFF] px-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-[420px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#F0EFFF] px-2.5 py-0.5 text-xs font-bold text-[#3729E6]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={updating}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#483BFF] hover:bg-[#F0EFFF] disabled:opacity-50"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close notifications"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Inbox size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  You will receive notifications here when new groups are assigned to you.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenGroup(item)}
                  className={`group relative flex cursor-pointer items-start gap-3 p-4 transition-colors ${
                    item.read
                      ? "bg-white hover:bg-slate-50"
                      : "bg-[#F8F9FE] hover:bg-[#F0EFFF]/60"
                  }`}
                >
                  {/* Unread indicator */}
                  <span
                    className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                      item.read ? "bg-transparent" : "bg-[#483BFF]"
                    }`}
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-md bg-[#483BFF]/10 px-2 py-0.5 text-xs font-bold text-[#3729E6]">
                          {item.groupCode}
                        </span>
                        {item.type === "reassignment" ? (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Reassigned
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            New Group
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {timeAgo(item.createdAtDate)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-medium text-slate-800">
                      {item.message || `Group ${item.groupCode} assigned to you.`}
                    </p>

                    {(item.trackName || item.coachName || item.day || item.time) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {item.trackName && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">
                            {item.trackName}
                          </span>
                        )}
                        {item.coachName && (
                          <span>Coach: <strong>{item.coachName}</strong></span>
                        )}
                        {item.day && item.time && (
                          <span>· {item.day} at {item.time}</span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#483BFF] group-hover:underline">
                        View group details
                        <ChevronRight size={13} />
                      </span>

                      {!item.read && (
                        <button
                          type="button"
                          onClick={(e) => markAsRead(item, e)}
                          title="Mark as read"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center text-xs text-slate-500 rounded-b-2xl">
              Click any notification to jump directly to its group.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
