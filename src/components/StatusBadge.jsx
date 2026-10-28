import React from "react";

/**
 * Reusable StatusBadge component following Coaching Ops semantic color tokens:
 * - Success / Completed / Active: #16A34A / #DCFCE7
 * - Warning / Pending / Reassigned / Rescheduled: #D97706 / #FEF3C7
 * - Danger / Cancelled / Issues: #DC2626 / #FEE2E2
 * - Information / Upcoming / Scheduled: #2563EB / #DBEAFE
 * - New Assignment: #483BFF / #EEF2FF
 * - Inactive / Historical / Superseded: #64748B / #F1F5F9
 */

const BADGE_VARIANTS = {
  // Success
  completed: {
    bg: "bg-[#DCFCE7]",
    text: "text-[#16A34A]",
    border: "border-[#BBF7D0]",
    dot: "bg-[#16A34A]",
    label: "Completed",
  },
  active: {
    bg: "bg-[#DCFCE7]",
    text: "text-[#16A34A]",
    border: "border-[#BBF7D0]",
    dot: "bg-[#16A34A]",
    label: "Active",
  },
  "دخل الجروب": {
    bg: "bg-[#DCFCE7]",
    text: "text-[#16A34A]",
    border: "border-[#BBF7D0]",
    dot: "bg-[#16A34A]",
    label: "Joined Group",
  },

  // Warning / Pending / Reassigned
  pending: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "Pending",
  },
  "in progress": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "In Progress",
  },
  rescheduled: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "Rescheduled",
  },
  reassigned: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "Reassigned to You",
  },
  "reassigned to you": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "Reassigned to You",
  },
  "يحتاج متابعة": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "Follow-up Needed",
  },
  "ردّ": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    border: "border-[#FDE68A]",
    dot: "bg-[#D97706]",
    label: "Replied",
  },

  // Danger
  cancelled: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#DC2626]",
    border: "border-[#FECACA]",
    dot: "bg-[#DC2626]",
    label: "Cancelled",
  },
  "رقم خطأ": {
    bg: "bg-[#FEE2E2]",
    text: "text-[#DC2626]",
    border: "border-[#FECACA]",
    dot: "bg-[#DC2626]",
    label: "Invalid Number",
  },

  // Information / Upcoming / Scheduled
  upcoming: {
    bg: "bg-[#DBEAFE]",
    text: "text-[#2563EB]",
    border: "border-[#BFDBFE]",
    dot: "bg-[#2563EB]",
    label: "Upcoming",
  },
  scheduled: {
    bg: "bg-[#DBEAFE]",
    text: "text-[#2563EB]",
    border: "border-[#BFDBFE]",
    dot: "bg-[#2563EB]",
    label: "Scheduled",
  },
  "تم التواصل": {
    bg: "bg-[#DBEAFE]",
    text: "text-[#2563EB]",
    border: "border-[#BFDBFE]",
    dot: "bg-[#2563EB]",
    label: "Contacted",
  },

  // New Assignment
  "new assignment": {
    bg: "bg-[#EEF2FF]",
    text: "text-[#483BFF]",
    border: "border-[#C7D2FE]",
    dot: "bg-[#483BFF]",
    label: "New Assignment",
  },
  new: {
    bg: "bg-[#EEF2FF]",
    text: "text-[#483BFF]",
    border: "border-[#C7D2FE]",
    dot: "bg-[#483BFF]",
    label: "New Assignment",
  },

  // Inactive / Historical
  inactive: {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    border: "border-[#E2E8F0]",
    dot: "bg-[#64748B]",
    label: "Inactive",
  },
  superseded: {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    border: "border-[#E2E8F0]",
    dot: "bg-[#64748B]",
    label: "Superseded",
  },
  "لم يُرسل": {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    border: "border-[#E2E8F0]",
    dot: "bg-[#64748B]",
    label: "Not Contacted",
  },
};

export default function StatusBadge({
  status = "",
  type,
  label,
  size = "md",
  showDot = true,
  className = "",
}) {
  const key = (type || status || "").trim().toLowerCase();
  const config =
    BADGE_VARIANTS[key] ||
    BADGE_VARIANTS[status] || {
      bg: "bg-[#F1F5F9]",
      text: "text-[#64748B]",
      border: "border-[#E2E8F0]",
      dot: "bg-[#64748B]",
      label: status || "Unknown",
    };

  const displayLabel = label || config.label || status;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : size === "lg"
      ? "px-3 py-1 text-xs"
      : "px-2.5 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full flex-none ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
