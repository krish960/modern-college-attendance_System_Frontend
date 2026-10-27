/*
  MyAttendancePage - a teacher's own attendance.
  Opened by: Staff (menu: My attendance).
  Lets the teacher check in for today and see the attendance list of a chosen month.
  API endpoints used: GET /staff-attendance/me/ (with the month), POST /staff-attendance/check-in/.
*/
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { DataTable } from "../../components/DataTable";
import { ErrorNote, Loading, PageHeader, StatusBadge } from "../../components/ui";
import { useAction } from "../../hooks/useAction";
import { useFetch } from "../../hooks/useData";
import { fmtDate, fmtDateTime } from "../../utils/format";

// Text shown for how each day was marked.
const SOURCE = { SELF: "You checked in", HOD: "Marked by HOD", SCAN: "ID card scanned", LECTURE: "Took a lecture", LEAVEREQ: "Approved leave" };

// Current month as YYYY-MM.
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** A teacher's own attendance: check in for today, and see the month. Submitting a lecture also marks the day present. */
export default function MyAttendancePage() {
  // Helper to run an action with a busy flag, the chosen month, and the attendance data from the API.
  const { run, busy } = useAction();
  const [month, setMonth] = useState(thisMonth());
  const mine = useFetch("/staff-attendance/me/", { month });
  // Show loading or an error message before drawing the page.
  if (mine.loading && !mine.data) return <Loading />;
  if (mine.error) return <ErrorNote message={mine.error} onRetry={mine.reload} />;
  // Pick the needed fields out of the response (late_after is the check-in time after which a teacher counts as Late).
  const { today, results, month_label: label, late_after: lateAfter } = mine.data;

  // Handler for the Check in now button: send the check-in, reload the data and show 'Checked in'.
  const checkIn = () =>
    run(async () => {
      await api.post("/staff-attendance/check-in/");
      mine.reload();
    }, "Checked in");

  // Table columns for the month list.
  const columns = [
    // Date column
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    // Status badge
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    // How the day was marked
    { key: "source", header: "How", render: (r) => SOURCE[r.source] || r.source },
    // Check-in time (the date part is cut off)
    { key: "check_in_at", header: "Time", render: (r) => (r.check_in_at ? fmtDateTime(r.check_in_at).split(", ").pop() : <span className="muted">–</span>) },
    // Note column
    { key: "note", header: "Note", render: (r) => r.note || <span className="muted">–</span> },
  ];

  // Page layout
  return (
    <>
      <PageHeader title="My attendance" subtitle="Check in when you reach college. A day on which you submit a lecture is marked present automatically." />
      {/* Today's status, or the check-in button if not checked in yet */}
      <div className="panel" style={{ padding: "1.2rem" }}>
        {today.status ? (
          <p>
            Today: <StatusBadge status={today.status} /> <span className="muted">({SOURCE[today.source] || today.source})</span>
          </p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: "0.8rem" }}>You have not checked in today. Check-in after {lateAfter} is recorded as Late.</p>
            <button className="btn" onClick={checkIn} disabled={busy}>Check in now</button> <Link className="btn secondary" to="/leave">Request leave</Link>
          </>
        )}
      </div>
      {/* Month picker and the month table */}
      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="toolbar">
          <div className="field">
            <label htmlFor="my-month">Month</label>
            <input id="my-month" type="month" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
          </div>
        </div>
        <DataTable columns={columns} rows={results} rowKey="date" emptyTitle={`Nothing recorded in ${label}`} emptyHint="Days appear here once you check in, take a lecture, or your HOD marks you." />
      </div>
    </>
  );
}
