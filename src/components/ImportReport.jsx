import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  UsersRound,
  X,
} from "lucide-react";

export default function ImportReport({ report, onClose }) {
  const [showSkipped, setShowSkipped] = useState(false);
  const [showErrors, setShowErrors] = useState(true);

  if (!report) return null;

  const {
    createdGroups = 0,
    updatedGroups = 0,
    unchangedGroups = 0,
    skippedGroups = [],
    createdStudents = 0,
    updatedStudents = 0,
    invalidRows = [],
    newSessions = 0,
    reassignedSessions = 0,
    notificationsCreated = 0,
  } = report;

  const totalGroupsProcessed =
    createdGroups + updatedGroups + unchangedGroups + skippedGroups.length + invalidRows.length;

  const hasIssues = skippedGroups.length > 0 || invalidRows.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                invalidRows.length > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {invalidRows.length > 0 ? (
                <AlertTriangle size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Excel Import Results Report
              </h2>
              <p className="text-xs text-slate-500">
                Processed {totalGroupsProcessed} group entries from workbook
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close report"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main KPI Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5">
              <span className="text-xs font-semibold text-emerald-800">
                New Groups Created
              </span>
              <strong className="mt-1 block text-2xl font-bold text-emerald-700">
                {createdGroups}
              </strong>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
              <span className="text-xs font-semibold text-blue-800">
                Existing Groups Updated
              </span>
              <strong className="mt-1 block text-2xl font-bold text-blue-700">
                {updatedGroups}
              </strong>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-slate-600">
                Unchanged Groups
              </span>
              <strong className="mt-1 block text-2xl font-bold text-slate-700">
                {unchangedGroups}
              </strong>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
              <span className="text-xs font-semibold text-amber-800">
                Skipped (Unassigned)
              </span>
              <strong className="mt-1 block text-2xl font-bold text-amber-700">
                {skippedGroups.length}
              </strong>
            </div>
          </div>

          {/* Secondary Details */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <span className="text-slate-500">Students Created:</span>{" "}
              <strong className="text-slate-800">{createdStudents}</strong>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <span className="text-slate-500">Students Updated:</span>{" "}
              <strong className="text-slate-800">{updatedStudents}</strong>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <span className="text-slate-500">Sessions Created:</span>{" "}
              <strong className="text-slate-800">{newSessions}</strong>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <span className="text-slate-500">Notifications Sent:</span>{" "}
              <strong className="text-slate-800">{notificationsCreated}</strong>
            </div>
          </div>

          {/* Data Safety Note */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 text-xs text-blue-800">
            <strong>Data Safety Guarantee:</strong> All existing student attendance,
            session notes, membership statuses, and manually rescheduled dates/times
            were preserved without changes.
          </div>

          {/* Invalid Rows / Errors List (if any) */}
          {invalidRows.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowErrors((prev) => !prev)}
                className="flex w-full items-center justify-between p-3.5 text-left text-xs font-bold text-red-900 hover:bg-red-50"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-600" />
                  <span>
                    Validation Issues / Invalid Rows ({invalidRows.length})
                  </span>
                </div>
                {showErrors ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showErrors && (
                <div className="border-t border-red-100 p-3">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-red-100/60 font-semibold text-red-900">
                        <tr>
                          <th className="p-2">Sheet</th>
                          <th className="p-2">Row</th>
                          <th className="p-2">Group Code</th>
                          <th className="p-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 text-slate-700">
                        {invalidRows.map((err, idx) => (
                          <tr key={idx} className="hover:bg-red-50/80">
                            <td className="p-2 font-mono text-slate-800">
                              {err.sheetName}
                            </td>
                            <td className="p-2">{err.excelRow}</td>
                            <td className="p-2 font-bold text-slate-900">
                              {err.groupCode || "—"}
                            </td>
                            <td className="p-2 text-red-700">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-red-600">
                    * Valid groups in the workbook were still imported successfully.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Skipped Groups (Unassigned Coordinator) List */}
          {skippedGroups.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSkipped((prev) => !prev)}
                className="flex w-full items-center justify-between p-3.5 text-left text-xs font-bold text-amber-900 hover:bg-amber-50"
              >
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-amber-600" />
                  <span>
                    Skipped Unassigned Groups ({skippedGroups.length})
                  </span>
                </div>
                {showSkipped ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showSkipped && (
                <div className="border-t border-amber-100 p-3">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-100/60 font-semibold text-amber-900">
                        <tr>
                          <th className="p-2">Sheet</th>
                          <th className="p-2">Row</th>
                          <th className="p-2">Group Code</th>
                          <th className="p-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-slate-700">
                        {skippedGroups.map((g, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/80">
                            <td className="p-2 font-mono text-slate-800">
                              {g.sheetName}
                            </td>
                            <td className="p-2">{g.excelRow}</td>
                            <td className="p-2 font-bold text-slate-900">
                              {g.groupCode}
                            </td>
                            <td className="p-2 text-amber-800">{g.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-amber-700">
                    * Per operational policy, groups without an assigned coordinator are not imported. Existing Firestore groups with empty coordinator in the workbook remain untouched.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#483BFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3729E6]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
