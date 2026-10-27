/*
  StaffDashboard - the home page of a teacher (Staff role).
  Opened by: Staff right after login.
  Shows: greeting, today's check-in status, summary cards, today's lectures and the subjects/classes assigned to the teacher.
  API endpoints used: GET /dashboard/, GET /staff-attendance/me/, POST /staff-attendance/check-in/,
  GET /assignments/ (active ones, up to 100).
*/
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { ActiveBadge, ErrorNote, Loading, PageHeader, StatCard, StatusBadge } from "../../components/ui";
import api from "../../api/client";
import { useAction } from "../../hooks/useAction";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useData";
import { fmtTime } from "../../utils/format";

/** True while the lecture's own time window contains the current local time. */
function isNow(l) {
  const d = new Date();
  const now = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return fmtTime(l.start_time) <= now && now < fmtTime(l.end_time);
}

export default function StaffDashboard() {
  // Logged-in user, navigation helper, and the data loaded from the API.
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch("/dashboard/");
  // Teacher's own attendance today, a helper to run an action with a busy flag, and the assigned subjects.
  const mine = useFetch("/staff-attendance/me/");
  const { run, busy } = useAction();
  const assignments = useFetch("/assignments/", { page_size: 100, is_active: "true" });
  // Show a loading message first, or an error with a retry button, before drawing the page.
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  // Summary numbers for the cards.
  const c = data.cards;

  // Columns of the 'Today's lectures' table.
  const todayColumns = [
    {
      // Time column: start-end time, with a 'Now' badge if the lecture is running at this moment
      key: "time",
      header: "Time",
      className: "num",
      render: (l) => (
        <>
          {fmtTime(l.start_time)}–{fmtTime(l.end_time)}
          {isNow(l) && <span className="badge good" style={{ marginLeft: "0.4rem" }}>Now</span>}
        </>
      ),
    },
    // Subject column
    { key: "subject_name", header: "Subject", render: (l) => <strong>{l.subject_name}</strong> },
    // Class column
    { key: "classroom_name", header: "Class" },
    // Lecture status badge (draft, submitted, ...)
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      // Button column: Take attendance for a draft lecture, View otherwise. stopPropagation stops the row click from also firing.
      key: "action",
      header: "",
      align: "right",
      render: (l) => (
        <Link className="btn sm" to={`/lectures/${l.id}`} onClick={(e) => e.stopPropagation()}>
          {l.status === "DRAFT" ? "Take attendance" : "View"}
        </Link>
      ),
    },
  ];

  // Columns of the 'assigned to me' table.
  const assignmentColumns = [
    { key: "subject_name", header: "Subject", render: (a) => <strong>{a.subject_name}</strong> },
    { key: "classroom_name", header: "Class" },
    { key: "academic_year", header: "Year" },
    { key: "is_active", header: "Status", render: (a) => <ActiveBadge active={a.is_active} /> },
  ];

  // Page layout
  return (
    <>
      <PageHeader
        title={`Hello, ${user.first_name || user.username}`}
        subtitle={user.department_name}
        actions={<Link className="btn" to="/attendance">Take attendance</Link>}
      />
      {mine.data && (
        <div className="panel today-strip" aria-label="My attendance today">
          <strong>My attendance today</strong>
          {mine.data.today.status ? (
            <StatusBadge status={mine.data.today.status} />
          ) : (
            <>
              <span className="muted">Not checked in yet (after {mine.data.late_after} counts as Late).</span>
              <span className="spacer" />
              <button className="btn sm" disabled={busy} onClick={() => run(async () => { await api.post("/staff-attendance/check-in/"); mine.reload(); }, "Checked in")}>Check in now</button>
            </>
          )}
          {mine.data.today.status && <><span className="spacer" /><Link className="btn ghost sm" to="/my-attendance">My attendance</Link></>}
        </div>
      )}
      {/* Summary cards: what I teach */}
      <h2 className="group-title">What I teach</h2>
      <div className="cards">
        <StatCard label="My subjects" value={c.assignments} />
        <StatCard label="My classes" value={c.classes} />
        <StatCard label="Students" value={c.students} />
        <StatCard label="Attendance" value={c.attendance_percentage === null ? "–" : `${c.attendance_percentage}%`} hint="My submitted lectures" />
      </div>
      {/* Summary cards: today */}
      <h2 className="group-title">Today</h2>
      <div className="cards">
        <StatCard label="Lectures today" value={c.lectures_today} tone="good" />
        <StatCard label="Waiting to submit" value={c.pending_lectures} tone={c.pending_lectures ? "warn" : ""} hint="Today and earlier" />
        <StatCard label="Correction requests" value={c.pending_corrections} hint="Awaiting HOD" />
      </div>

      {/* Table of today's lectures; clicking a row opens that lecture */}
      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <div className="panel-head"><h2>Today's lectures</h2></div>
        <DataTable
          columns={todayColumns}
          rows={data.today}
          onRowClick={(l) => navigate(`/lectures/${l.id}`)}
          emptyTitle="No lectures today"
          emptyHint="Your HOD generates lectures from the timetable. For an extra class, add a lecture yourself."
          emptyAction={<Link className="btn secondary" to="/attendance">Add a lecture</Link>}
        />
      </div>

      {/* Table of subjects and classes assigned to this teacher */}
      <div className="panel">
        <div className="panel-head"><h2>Subjects and classes assigned to me</h2></div>
        <DataTable
          columns={assignmentColumns}
          rows={assignments.data?.results || []}
          loading={assignments.loading}
          error={assignments.error}
          onRetry={assignments.reload}
          emptyTitle="Nothing assigned yet"
          emptyHint="Ask your HOD to assign you to a subject and class."
        />
      </div>
    </>
  );
}
