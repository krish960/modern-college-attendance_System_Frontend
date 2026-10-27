/*
 * Staff on leave page. Opened by the Admin only.
 * Shows every teacher marked 'On leave' on a chosen day, across all departments.
 * Data comes from GET /api/staff-attendance/on-leave/?date=...
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { ErrorNote, Loading, PageHeader } from "../../components/ui";
import { useFetch } from "../../hooks/useData";
import { fmtDate, todayISO } from "../../utils/format";

export default function OnLeavePage() {
  // The chosen date. Starts as today. Future dates are blocked in the input.
  const [day, setDay] = useState(todayISO());
  const { data, loading, error, reload } = useFetch("/staff-attendance/on-leave/", { date: day });
  // Columns. The 'Leave' column shows the date range of an approved leave
  // request, or 'Marked by the HOD' when the HOD marked it directly with no request.
  const columns = [
    { key: "name", header: "Teacher", render: (r) => <strong>{r.name}</strong> },
    { key: "employee_id", header: "Staff ID" },
    { key: "department", header: "Department" },
    { key: "when", header: "Leave", render: (r) => (r.from_date ? `${fmtDate(r.from_date)} to ${fmtDate(r.to_date)}` : <span className="muted">Marked by the HOD</span>) },
    { key: "reason", header: "Reason", render: (r) => r.reason || r.note || <span className="muted">–</span> },
  ];
  return (
    <>
      <PageHeader
        title="Staff on leave"
        subtitle="Teachers marked On leave on the chosen day, from every department."
        actions={<Link className="btn secondary" to="/admin">Back to dashboard</Link>}
      />
      <div className="panel">
        {/* Toolbar: date picker (an empty value falls back to today) */}
        <div className="toolbar">
          <div className="field"><label htmlFor="ol-day">Date</label><input id="ol-day" type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value || todayISO())} /></div>
        </div>
        {/* Loading, error or table. rowKey is the teacher's user id. */}
        {loading && !data ? <Loading /> : error ? <ErrorNote message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={data.results} rowKey="user" emptyTitle="Nobody is on leave" emptyHint="No teacher is marked On leave on this date." />
        )}
      </div>
    </>
  );
}
