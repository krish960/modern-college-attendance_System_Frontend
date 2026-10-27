/*
 * Daily attendance report page. Opened by the Admin (all departments) and the HOD (own department).
 * Lists every scheduled lecture in a date range with its attendance count and status.
 * Data: GET /api/reports/daily/. The same filters are used for the CSV and PDF export.
 * Clicking a row opens that lecture (LecturePage).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FilterSelect, PageHeader, Pct, SearchInput, StatCard, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounce, useFetch, useOptions } from "../hooks/useData";
import { parseError } from "../utils/errors";
import { downloadExport } from "../utils/download";
import { fmtDate, todayISO } from "../utils/format";

// Choices for the Status filter. The value is what the server expects in ?status=.
const STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PENDING", label: "Pending" },
  { value: "SCHEDULED", label: "Scheduled (future)" },
  { value: "CANCELLED", label: "Cancelled" },
];
// Semester choices 1 to 8 for the Semester filter.
const SEMESTERS = Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: `Semester ${i + 1}` }));

export default function DailyReportPage() {
  // The signed-in user. The Department filter and column are for the Admin only.
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Filter values. Both dates start on today, so the page opens on today's lectures.
  const [f, setF] = useState({ date_from: todayISO(), date_to: todayISO(), department: "", subject: "", teacher: "", classroom: "", semester: "", status: "" });
  // Returns a handler that updates one filter value.
  const set = (key) => (value) => setF((old) => ({ ...old, [key]: value }));
  // Which export is running ("csv", "pdf" or ""). Used to disable the buttons and show "Preparing...".
  const [exporting, setExporting] = useState("");

  // Search text. It is delayed a little (debounce) so the server is not called on every key press.
  const [search, setSearch] = useState("");
  const q = useDebounce(search);
  // All query parameters sent to the report endpoint.
  const params = { ...f, search: q };
  // Loads the report: a summary block plus one row per lecture.
  const report = useFetch("/reports/daily/", params);
  // Dropdown choices for the filters, each loaded from its own endpoint.
  const depts = useOptions("/departments/", (d) => ({ value: d.id, label: d.name }), undefined);
  const subjects = useOptions("/subjects/", (s) => ({ value: s.id, label: s.name }), undefined);
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), undefined);
  const staff = useOptions("/staff/", (u) => ({ value: u.id, label: u.full_name }), undefined);
  // Totals for the stat cards at the top (may be missing while loading).
  const summary = report.data?.summary;

  // Download the report as CSV or PDF using the same filters as the table.
  const exportAs = async (kind) => {
    setExporting(kind);
    try {
      // Empty filters are removed so they are not sent as ?subject=&...
      const exportParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ""));
      await downloadExport("/reports/daily/", exportParams, kind);
    } catch (e) {
      // Errors on a blob request come back as a Blob, so show a plain message.
      toast.error(e.response?.data instanceof Blob ? "Could not export. Check the filters and try again." : parseError(e).message);
    } finally {
      setExporting("");
    }
  };

  // Table columns. The Department column is shown to the Admin only.
  const columns = [
    { key: "date", header: "Date", className: "nowrap", render: (r) => fmtDate(r.date) },
    { key: "time", header: "Time", className: "num nowrap", render: (r) => `${r.start_time}–${r.end_time}` },
    ...(user.role === "ADMIN" ? [{ key: "department", header: "Department" }] : []),
    { key: "class_name", header: "Class", className: "nowrap" },
    { key: "subject", header: "Subject", render: (r) => <strong>{r.subject}</strong> },
    { key: "teacher", header: "Teacher" },
    { key: "total_students", header: "Total students", align: "right", className: "num" },
    // A lecture that was not submitted has no present count yet, so say so.
    { key: "present", header: "Present", align: "right", className: "num nowrap", render: (r) => (r.present ?? <span className="muted">Not submitted</span>) },
    { key: "absent", header: "Absent", align: "right", className: "num", render: (r) => r.absent ?? "–" },
    // Colour-coded percentage. Status shows Submitted, Pending, Scheduled or Cancelled.
    { key: "percentage", header: "Attendance", render: (r) => <Pct value={r.percentage} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      {/* Page title and the two export buttons. */}
      <PageHeader
        title="Daily attendance report"
        subtitle="Submitted and pending attendance for every scheduled lecture. A lecture is pending only when it was scheduled and has not been submitted."
        actions={
          <>
            <button className="btn secondary" onClick={() => exportAs("xlsx")} disabled={Boolean(exporting)}>{exporting === "xlsx" ? "Preparing…" : "Export Excel"}</button>
            <button className="btn secondary" onClick={() => exportAs("csv")} disabled={Boolean(exporting)}>{exporting === "csv" ? "Preparing…" : "Export CSV"}</button>
            <button className="btn secondary" onClick={() => exportAs("pdf")} disabled={Boolean(exporting)}>{exporting === "pdf" ? "Preparing…" : "Export PDF"}</button>
          </>
        }
      />

      {/* Summary cards (shown once the report has loaded). */}
      {summary && (
        <div className="cards">
          <StatCard label="Lectures" value={summary.lectures} />
          <StatCard label="Submitted" value={summary.submitted} tone="good" />
          <StatCard label="Pending" value={summary.pending} tone={summary.pending ? "warn" : ""} />
          <StatCard label="Cancelled" value={summary.cancelled} />
          <StatCard label="Present marks" value={summary.present} />
          <StatCard label="Absent marks" value={summary.absent} />
          <StatCard label="Attendance" value={summary.percentage === null ? "–" : `${summary.percentage}%`} hint="Submitted lectures" />
        </div>
      )}

      {/* Table card: filters first, then the table. */}
      <div className="panel">
        {/* Toolbar with search and filters. */}
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Subject, class or teacher" />
          <div className="field">
            <label htmlFor="r-from">From</label>
            {/* Changing From also moves To forward if To would be earlier than From. */}
            <input id="r-from" type="date" value={f.date_from} onChange={(e) => e.target.value && setF((o) => ({ ...o, date_from: e.target.value, date_to: o.date_to < e.target.value ? e.target.value : o.date_to }))} />
          </div>
          <div className="field">
            <label htmlFor="r-to">To</label>
            {/* To cannot be before From (min). Ignore an empty value. */}
            <input id="r-to" type="date" value={f.date_to} min={f.date_from} onChange={(e) => e.target.value && set("date_to")(e.target.value)} />
          </div>
          {user.role === "ADMIN" && <FilterSelect label="Department" value={f.department} onChange={set("department")} options={depts.options} allLabel="All departments" />}
          <FilterSelect label="Subject" value={f.subject} onChange={set("subject")} options={subjects.options} allLabel="All subjects" />
          <FilterSelect label="Teacher" value={f.teacher} onChange={set("teacher")} options={staff.options} allLabel="All teachers" />
          <FilterSelect label="Class" value={f.classroom} onChange={set("classroom")} options={classes.options} allLabel="All classes" />
          <FilterSelect label="Semester" value={f.semester} onChange={set("semester")} options={SEMESTERS} allLabel="All semesters" />
          <FilterSelect label="Status" value={f.status} onChange={set("status")} options={STATUS_OPTIONS} allLabel="Any status" />
        </div>
        {/* Lecture table. Clicking a row opens the lecture. */}
        <DataTable
          columns={columns}
          rows={report.data?.results || []}
          loading={report.loading}
          error={report.error}
          onRetry={report.reload}
          rowKey="lecture_id"
          onRowClick={(r) => navigate(`/lectures/${r.lecture_id}`)}
          emptyTitle="No lectures in this range"
          emptyHint="Lectures are created from the timetable or added by teachers. A date with no scheduled lecture shows nothing, not pending."
        />
      </div>
    </>
  );
}
