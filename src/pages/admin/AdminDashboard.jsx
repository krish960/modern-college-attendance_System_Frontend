/*
 * Admin dashboard (college overview). Opened by the Admin only.
 * Same light look as the HOD dashboard: card groups, charts and tables.
 * Loads one summary from GET /api/dashboard/ and shows college-wide cards, the 14 day
 * attendance trend, department-wise attendance, work waiting for the admin,
 * staff today, leave this month, lowest attendance students, recent activity and downloads.
 */

import { Link } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { BarList, TrendChart } from "../../components/Charts";
import { DownloadButtons, DownloadEverything } from "../../components/DownloadButtons";
import { ErrorNote, Loading, PageHeader, Pct, StatCard } from "../../components/ui";
import { useFetch } from "../../hooks/useData";
import { fmtDateTime } from "../../utils/format";

// Long date shown under the page title.
const today = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function AdminDashboard() {
  // Load the dashboard summary. Admin only on the server side too.
  const { data, loading, error, reload } = useFetch("/dashboard/");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  // c = top cards, st = staff status today, w = items waiting for a decision, limit = minimum attendance.
  const c = data.cards, st = data.staff_today, w = data.waiting;
  const limit = data.low_attendance.threshold ?? 75;

  // Department table: HOD, size and attendance of each department.
  const deptColumns = [
    { key: "name", header: "Department", render: (d) => <strong>{d.name}{d.is_active ? "" : " (inactive)"}</strong> },
    { key: "hod", header: "HOD", render: (d) => d.hod || <span className="muted">No HOD</span> },
    { key: "student_count", header: "Students", align: "right", className: "num" },
    { key: "staff_count", header: "Teachers", align: "right", className: "num" },
    { key: "attendance_percentage", header: "Attendance", render: (d) => <Pct value={d.attendance_percentage} /> },
  ];
  // Students below the limit in the last 30 days.
  const lowColumns = [
    { key: "roll_number", header: "Roll no.", className: "num", render: (r) => <strong>{r.roll_number}</strong> },
    { key: "name", header: "Student" },
    { key: "class_name", header: "Class" },
    { key: "percentage", header: "Attendance", render: (r) => <Pct value={r.percentage} /> },
  ];
  // Teacher attendance today, one row per state.
  const staffRows = [
    ["Present", st.present], ["Late", st.late], ["Half day", st.half_day],
    ["Absent", st.absent], ["On leave", st.leave], ["Not marked", st.not_marked],
  ].map(([label, count]) => ({ label, count }));
  const staffColumns = [
    { key: "label", header: "Teachers today", render: (r) => <strong>{r.label}</strong> },
    { key: "count", header: "Count", align: "right", className: "num" },
  ];
  // Approved leave this month, by leave type.
  const leaveColumns = [
    { key: "label", header: "Leave type", render: (r) => <strong>{r.label}</strong> },
    { key: "teachers", header: "Teachers", align: "right", className: "num" },
  ];
  // Latest entries of the audit log.
  const activityColumns = [
    { key: "action", header: "Action", render: (a) => <strong>{a.action}</strong> },
    { key: "who", header: "By", render: (a) => `${a.who}${a.department ? `, ${a.department}` : ""}` },
    { key: "when", header: "When", render: (a) => fmtDateTime(a.when) },
  ];

  return (
    <>
      {/* Page title with the date and shortcuts */}
      <PageHeader
        title="College overview"
        subtitle={today()}
        actions={
          <>
            <Link className="btn secondary" to="/reports">Daily report</Link>
            <Link className="btn secondary" to="/staff-attendance">Staff attendance</Link>
            <Link className="btn" to="/admin/departments">Manage departments</Link>
          </>
        }
      />
      {/* Card group: size of the college */}
      <h2 className="group-title">Your college</h2>
      <div className="cards">
        <StatCard label="Students" value={c.students} />
        <StatCard label="Teachers" value={c.staff} />
        <StatCard label="Departments" value={c.active_departments} hint={`${c.active_hods} HODs`} />
        <StatCard label="Attendance" value={c.attendance_percentage === null ? "–" : `${c.attendance_percentage}%`} hint="Submitted lectures" />
      </div>
      {/* Card group: today's lectures and teacher presence */}
      <h2 className="group-title">Today</h2>
      <div className="cards">
        <StatCard label="Lectures today" value={c.lectures_today} hint={`${c.submitted_today} submitted`} tone="good" />
        <StatCard label="Pending today" value={c.pending_today} tone={c.pending_today ? "warn" : ""} />
        <StatCard label="Overdue, not submitted" value={c.overdue_pending} tone={c.overdue_pending ? "bad" : ""} hint="Earlier dates" />
        <StatCard label="Teachers on leave" value={c.staff_on_leave} hint="Today" />
      </div>
      {/* Card group: work waiting for a decision. Cards turn yellow when the number is above 0. */}
      <h2 className="group-title">Needs your attention</h2>
      <div className="cards">
        <Link to="/leave" className="card-link"><StatCard label="Leave requests" value={w.leave_requests} tone={w.leave_requests ? "warn" : ""} /></Link>
        <Link to="/reports" className="card-link"><StatCard label="Corrections" value={w.corrections} tone={w.corrections ? "warn" : ""} /></Link>
        <Link to="/promotions" className="card-link"><StatCard label="Class promotions" value={w.promotions} tone={w.promotions ? "warn" : ""} hint="To approve" /></Link>
        <Link to="/removals" className="card-link"><StatCard label="Student removals" value={w.student_removals} tone={w.student_removals ? "warn" : ""} /></Link>
      </div>

      {/* Charts: 14 day trend and attendance per department */}
      <div className="chart-row">
        <div className="panel"><TrendChart points={data.trend} threshold={limit} /></div>
        <div className="panel">
          <BarList
            title="Department-wise attendance"
            threshold={limit}
            items={data.departments.filter((d) => d.attendance_percentage !== null).map((d) => ({ label: d.name, value: d.attendance_percentage }))}
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <div className="panel-head"><h2>Departments</h2><Link className="btn ghost sm" to="/admin/departments">Manage</Link></div>
        <DataTable columns={deptColumns} rows={data.departments} rowKey="id" emptyTitle="No departments yet" emptyHint="Create a department to start." emptyAction={<Link className="btn secondary" to="/admin/departments">Create department</Link>} />
      </div>

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <div className="panel-head">
          <h2>Students with low attendance</h2>
          <span className="muted small">{data.low_attendance.count} below {limit}%, last 30 days</span>
        </div>
        <DataTable columns={lowColumns} rows={data.low_attendance.students} rowKey="roll_number" emptyTitle="No student is below the limit" emptyHint={`Students appear here when they are under ${limit}%.`} />
      </div>

      <div className="chart-row">
        <div className="panel">
          <div className="panel-head"><h2>Teachers today</h2><Link className="btn ghost sm" to="/staff-attendance">Open</Link></div>
          <DataTable columns={staffColumns} rows={staffRows} rowKey="label" />
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Leave this month</h2><Link className="btn ghost sm" to="/leave">Open</Link></div>
          <DataTable columns={leaveColumns} rows={data.leave_month} rowKey="type" emptyTitle="No approved leave this month" emptyHint="Approved leave appears here by type." />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <div className="panel-head"><h2>Latest activity</h2><Link className="btn ghost sm" to="/audit-logs">See all</Link></div>
        <DataTable columns={activityColumns} rows={data.recent_activity} rowKey="when" emptyTitle="No activity yet" />
      </div>

      {/* Downloads. Each button exports one table to Excel. 'Everything' gives a ZIP. */}
      <div className="panel">
        <div className="panel-head"><h2>Save your data</h2></div>
        <div className="download-grid">
          {[["students", "Students"], ["staff", "Teachers"], ["hods", "HODs"], ["leave", "Leave"]].map(([what, label]) => (
            <div key={what}><strong>{label}</strong> <DownloadButtons what={what} label="" /></div>
          ))}
          <div><strong>Everything</strong> <DownloadEverything /></div>
        </div>
        <p className="muted small" style={{ padding: "0 1rem 1rem" }}>The Excel files open Marathi names correctly. The ZIP holds every table, including each attendance mark. Downloads are written to the audit log.</p>
      </div>
    </>
  );
}
