/*
 * HOD dashboard. Opened by the HOD only.
 * Shows the numbers for the HOD's own department: cards, trend, subject-wise
 * attendance, students with low attendance and today's lectures.
 * Data: /api/dashboard/, /api/reports/daily/, /api/staff-attendance/day/ and /api/leave-requests/.
 */

import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { BarList, TrendChart } from "../../components/Charts";
import { ErrorNote, Loading, PageHeader, Pct, StatCard, StatusBadge } from "../../components/ui";
import { useFetch } from "../../hooks/useData";
import { fmtTime, todayISO } from "../../utils/format";

export default function HodDashboard() {
  // Used to open a lecture when its row is clicked.
  const navigate = useNavigate();
  // Main summary for the department. The page waits for this one.
  const { data, loading, error, reload } = useFetch("/dashboard/");
  // Extra loads for today. These do not block the page: their cards show only when data arrives.
  // today = today's lectures. staffToday = teacher attendance today. leaves = open leave requests (page_size 1, only the count is needed).
  const today = useFetch("/reports/daily/", { date: todayISO() });
  const staffToday = useFetch("/staff-attendance/day/", { date: todayISO() });
  const leaves = useFetch("/leave-requests/", { status: "OPEN", page_size: 1 });
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  // c = the card numbers from the dashboard data.
  const c = data.cards;

  // Columns for 'Today's lectures'. Present / Total is shown only after the teacher submitted.
  const todayColumns = [
    { key: "time", header: "Time", className: "num", render: (r) => `${r.start_time}–${r.end_time}` },
    { key: "subject", header: "Subject", render: (r) => <strong>{r.subject}</strong> },
    { key: "class_name", header: "Class" },
    { key: "teacher", header: "Teacher" },
    { key: "marks", header: "Present / Total", className: "num", render: (r) => (r.status === "SUBMITTED" ? `${r.present} / ${r.total_students}` : <span className="muted">Not submitted</span>) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Columns for students under the attendance limit.
  const lowColumns = [
    { key: "roll_number", header: "Roll no.", className: "num", render: (r) => <strong>{r.roll_number}</strong> },
    { key: "name", header: "Student" },
    { key: "class_name", header: "Class" },
    { key: "present", header: "Present / Lectures", className: "num", render: (r) => `${r.present} / ${r.total}` },
    { key: "percentage", header: "Attendance", render: (r) => <Pct value={r.percentage} /> },
  ];

  // Columns for subject-wise attendance (marks given across all lectures).
  const subjectColumns = [
    { key: "subject", header: "Subject", render: (r) => <strong>{r.subject}</strong> },
    { key: "present", header: "Present marks", align: "right", className: "num" },
    { key: "total", header: "Total marks", align: "right", className: "num" },
    { key: "percentage", header: "Attendance", render: (r) => <Pct value={r.percentage} /> },
  ];

  return (
    <>
      {/* Page title (department name) and shortcuts to related pages */}
      <PageHeader
        title={data.department}
        subtitle="Department dashboard"
        actions={
          <>
            <Link className="btn secondary" to="/reports">Daily report</Link>
            <Link className="btn secondary" to="/staff-attendance">Staff attendance</Link>
            <Link className="btn" to="/corrections">Review corrections</Link>
          </>
        }
      />
      {/* Card group: size of the department */}
      <h2 className="group-title">Your department</h2>
      <div className="cards">
        <StatCard label="Staff" value={c.staff} />
        <StatCard label="Classes" value={c.classes} />
        <StatCard label="Subjects" value={c.subjects} />
        <StatCard label="Students" value={c.students} />
      </div>
      {/* Card group: today's lectures and teacher presence */}
      <h2 className="group-title">Today</h2>
      <div className="cards">
        <StatCard label="Lectures today" value={c.lectures_today} hint={`${c.submitted_today} submitted`} tone="good" />
        <StatCard label="Pending today" value={c.pending_today} tone={c.pending_today ? "warn" : ""} />
        <StatCard label="Overdue, not submitted" value={c.overdue_pending} tone={c.overdue_pending ? "bad" : ""} hint="Earlier dates" />
        {staffToday.data && <StatCard label="Teachers present today" value={`${staffToday.data.summary.present + staffToday.data.summary.late} / ${staffToday.data.summary.staff}`} tone="good" hint={`${staffToday.data.summary.not_marked} not marked yet`} />}
      </div>
      {/* Card group: work waiting for the HOD. Cards turn yellow or red when the number is above 0. */}
      <h2 className="group-title">Needs your attention</h2>
      <div className="cards">
        <StatCard label="Correction requests" value={c.pending_corrections} tone={c.pending_corrections ? "warn" : ""} hint="Waiting for you" />
        {leaves.data && <StatCard label="Leave requests" value={leaves.data.count} tone={leaves.data.count ? "warn" : ""} hint="Waiting for you" />}
        <StatCard label="Low attendance" value={c.low_attendance_students} tone={c.low_attendance_students ? "bad" : ""} hint={`Below ${data.low_attendance.threshold}%, last ${data.low_attendance.days} days`} />
        <StatCard label="Attendance" value={c.attendance_percentage === null ? "–" : `${c.attendance_percentage}%`} hint="Submitted lectures" />
      </div>

      {/* Charts: 14 day trend and attendance per subject. The threshold line is the minimum allowed percentage. */}
      <div className="chart-row">
        <div className="panel"><TrendChart points={data.trend} threshold={data.low_attendance.threshold} /></div>
        <div className="panel">
          <BarList
            title="Subject-wise attendance"
            threshold={data.low_attendance.threshold}
            items={data.subject_wise.map((r) => ({ label: r.subject, value: r.percentage }))}
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <div className="panel-head">
          {/* Table: students below the limit in the last few days */}
          <h2>Students with low attendance</h2>
          <Link className="btn ghost sm" to="/summary">Class summary</Link>
        </div>
        <DataTable
          columns={lowColumns}
          rows={data.low_attendance.students}
          rowKey="student"
          emptyTitle="No student is below the limit"
          emptyHint={`Students appear here when they are under ${data.low_attendance.threshold}% over the last ${data.low_attendance.days} days (after at least ${data.low_attendance.min_lectures} lectures).`}
        />
      </div>

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <div className="panel-head">
          {/* Table: today's lectures. Clicking a row opens that lecture. */}
          <h2>Today's lectures</h2>
          <Link className="btn ghost sm" to="/reports">Full report</Link>
        </div>
        <DataTable
          columns={todayColumns}
          rows={today.data?.results || []}
          loading={today.loading}
          error={today.error}
          onRetry={today.reload}
          onRowClick={(r) => navigate(`/lectures/${r.lecture_id}`)}
          rowKey="lecture_id"
          emptyTitle="No lectures scheduled today"
          emptyHint="Generate lectures from the timetable to see today's sessions and who has not submitted yet."
          emptyAction={<Link className="btn secondary" to="/hod/timetable">Open timetable</Link>}
        />
      </div>

      <div className="panel">
        {/* Table: attendance per subject */}
        <div className="panel-head"><h2>Subject-wise attendance</h2></div>
        <DataTable columns={subjectColumns} rows={data.subject_wise} rowKey="subject" emptyTitle="No submitted attendance yet" emptyHint="Figures appear once teachers submit attendance." />
      </div>
    </>
  );
}
