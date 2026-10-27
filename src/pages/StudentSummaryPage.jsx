/*
 * Student summary page. Opened by the Admin, the HOD and the Teacher.
 * Shows each student's present, absent and attendance percentage for one class.
 * Can be narrowed by subject and date range. Students under the attendance limit
 * are marked as low attendance.
 * Data: GET /api/reports/student-summary/. Can be exported as CSV or PDF.
 */

import { useState } from "react";
import { DataTable } from "../components/DataTable";
import { FilterSelect, PageHeader, Pct, SearchInput } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useFetch, useOptions } from "../hooks/useData";
import { downloadExport } from "../utils/download";
import { parseError } from "../utils/errors";
import { byRoll } from "../utils/format";

// True if the student's roll number or name contains the typed text. Empty text matches everyone.
const matches = (r, text) => {
  const t = text.trim().toLowerCase();
  return !t || r.name.toLowerCase().includes(t) || String(r.roll_number).toLowerCase().includes(t);
};

/** Student-wise attendance percentage for one class, optionally for one subject and date range. */
export default function StudentSummaryPage() {
  const toast = useToast();
  // Filters. A class must be chosen before anything is loaded.
  const [f, setF] = useState({ classroom: "", subject: "", date_from: "", date_to: "", low_only: false });
  // Returns a handler that updates one filter value.
  const set = (key) => (value) => setF((old) => ({ ...old, [key]: value }));
  // Dropdown choices for the class and subject filters.
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), undefined);
  const subjects = useOptions("/subjects/", (s) => ({ value: s.id, label: s.name }), undefined);
  // Loads the summary only after a class is chosen (last argument). low_only is sent as "true" or left out.
  const summary = useFetch("/reports/student-summary/", { ...f, low_only: f.low_only ? "true" : "" }, Boolean(f.classroom));
  // The attendance limit comes from the server (75 percent is the fallback).
  const threshold = summary.data?.threshold ?? 75;
  // How many students in the current list are below the limit.
  const lowCount = (summary.data?.results || []).filter((r) => r.low).length;
  // Which export is running ("csv", "pdf" or "").
  const [exporting, setExporting] = useState("");
  // Text typed in the Find student box (filters the rows already loaded).
  const [find, setFind] = useState("");

  // Download the summary. Empty filters and low_only are left out of the export request.
  const exportAs = async (kind) => {
    setExporting(kind);
    try {
      await downloadExport("/reports/student-summary/", Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== "" && v !== false && k !== "low_only")), kind);
    } catch (e) {
      toast.error(e.response?.data instanceof Blob ? "Could not export." : parseError(e).message);
    } finally {
      setExporting("");
    }
  };

  // Table columns. The last column shows a badge for low attendance.
  const columns = [
    { key: "roll_number", header: "Roll no.", className: "num", render: (r) => <strong>{r.roll_number}</strong> },
    { key: "name", header: "Student" },
    { key: "present", header: "Present", align: "right", className: "num" },
    { key: "absent", header: "Absent", align: "right", className: "num" },
    { key: "total", header: "Lectures", align: "right", className: "num" },
    { key: "percentage", header: "Attendance", render: (r) => <Pct value={r.percentage} /> },
    { key: "low", header: "", render: (r) => (r.low ? <span className="badge bad">Low attendance</span> : null) },
  ];

  return (
    <>
      {/* Page title and export buttons (buttons appear once a class is chosen). */}
      <PageHeader
        title="Student summary"
        subtitle="Attendance per student, from submitted lectures. Students under the attendance limit are marked as low attendance."
        actions={
          f.classroom && (
            <>
              <button className="btn secondary" onClick={() => exportAs("xlsx")} disabled={Boolean(exporting)}>Export Excel</button>
              <button className="btn secondary" onClick={() => exportAs("csv")} disabled={Boolean(exporting)}>Export CSV</button>
              <button className="btn secondary" onClick={() => exportAs("pdf")} disabled={Boolean(exporting)}>Export PDF</button>
            </>
          )
        }
      />
      {/* Card with filters and the table. */}
      <div className="panel">
        {/* Toolbar with find box, class, subject, date range and the low attendance checkbox. */}
        <div className="toolbar">
          <SearchInput id="sum-find" label="Find student" value={find} onChange={setFind} placeholder="Roll number or name" />
          <FilterSelect label="Class" value={f.classroom} onChange={set("classroom")} options={classes.options} allLabel="Choose a class" />
          <FilterSelect label="Subject" value={f.subject} onChange={set("subject")} options={subjects.options} allLabel="All subjects" />
          <div className="field">
            <label htmlFor="s-from">From</label>
            <input id="s-from" type="date" value={f.date_from} onChange={(e) => set("date_from")(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="s-to">To</label>
            <input id="s-to" type="date" value={f.date_to} onChange={(e) => set("date_to")(e.target.value)} />
          </div>
          <div className="field">
            <label className="check" htmlFor="s-low" style={{ marginTop: "1.6rem" }}>
              <input id="s-low" type="checkbox" checked={f.low_only} onChange={(e) => set("low_only")(e.target.checked)} />
              Only low attendance
            </label>
          </div>
        </div>
        {!f.classroom ? (
          // No class chosen yet.
          <div className="empty"><h3>Choose a class</h3><p>Pick a class above to see each student's attendance.</p></div>
        ) : (
          // Class chosen: show a warning count and the table.
          <>
          {/* Warning shown only when low students are mixed in with the rest of the list. */}
          {!f.low_only && lowCount > 0 && (
            <p className="alert-note" role="status">{lowCount} student{lowCount === 1 ? " is" : "s are"} below {threshold}% in this view.</p>
          )}
          {/* Student table. Rows below the limit are shaded. */}
          <DataTable
            rowClass={(r) => (r.low ? "low-row" : "")}
            columns={columns}
            rows={[...(summary.data?.results || [])].filter((r) => matches(r, find)).sort(byRoll)}
            loading={summary.loading}
            error={summary.error}
            onRetry={summary.reload}
            rowKey="student"
            emptyTitle="No students in this class"
            emptyHint={f.low_only ? "Nobody is below the attendance limit." : "Register students in the class first."}
          />
          </>
        )}
      </div>
    </>
  );
}
