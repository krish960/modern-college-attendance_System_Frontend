/*
  StudentRecordsPage - attendance records of every student for a month, a year or any dates.
  Opened by: Admin (all departments) and HOD (own department). Click a student row to see the whole year.
  API endpoints used: GET /departments/ (admin only), GET /classes/,
  GET /reports/student-records/ (table, summary cards and Excel/PDF download),
  GET /reports/student-records/:studentId/ (the yearly popup).
*/
import { useState } from "react";
import { PagedTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { ErrorNote, FilterSelect, Loading, PageHeader, Pct, SearchInput } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounce, useFetch, useOptions, usePaginated } from "../hooks/useData";
import { downloadExport } from "../utils/download";
import { parseError } from "../utils/errors";
import { fmtPct, todayISO } from "../utils/format";

// Current month (YYYY-MM) and current year (YYYY), used as default filters.
const thisMonth = () => todayISO().slice(0, 7);
const thisYear = () => todayISO().slice(0, 4);

/** One student's year, month by month and subject by subject. */
// Popup that shows one student's year, month by month and subject by subject.
function YearModal({ student, year, onClose }) {
  // Year typed in the popup, and the data loaded for that student and year.
  const [y, setY] = useState(year);
  const { data, loading, error, reload } = useFetch(`/reports/student-records/${student.student}/`, { year: y });
  return (
    <Modal title={`${student.name} · ${student.class_name}`} onClose={onClose} wide>
      {/* Year input */}
      <div className="modal-body">
        <div className="row">
          <label htmlFor="rec-year" className="small">Year</label>
          <input id="rec-year" type="number" min="2000" max="2100" value={y} onChange={(e) => setY(e.target.value)} style={{ width: "6rem" }} />
          {data && <span className="muted">{student.department} · Roll {student.roll_number}</span>}
        </div>
        {loading && !data && <Loading />}
        {error && <ErrorNote message={error} onRetry={reload} />}
        {data && (
          <>
            <p><strong>{fmtPct(data.total.percentage)}</strong> in {data.year}: present {data.total.present} of {data.total.total} marked lectures.</p>
            {/* Month-wise table */}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Month</th><th className="right">Present</th><th className="right">Absent</th><th className="right">Total</th><th>Attendance</th></tr></thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month}><td>{m.label}</td><td className="right num">{m.present}</td><td className="right num">{m.absent}</td><td className="right num">{m.total}</td><td>{m.total ? <Pct value={m.percentage} /> : <span className="muted">No lectures</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.subjects.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Subject</th><th className="right">Present</th><th className="right">Total</th><th>Attendance</th></tr></thead>
                  <tbody>
                    {data.subjects.map((s) => <tr key={s.subject}><td>{s.subject}</td><td className="right num">{s.present}</td><td className="right num">{s.total}</td><td><Pct value={s.percentage} /></td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Admin (every department) and HOD (own department): attendance of every student for a month, a year or any dates. */
// Main page component.
export default function StudentRecordsPage() {
  // Logged-in user, toast helper, and an admin flag.
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "ADMIN";
  // Filter state: which period type (month / year / range) and its values.
  const [period, setPeriod] = useState("month");
  const [month, setMonth] = useState(thisMonth());
  const [year, setYear] = useState(thisYear());
  const [from, setFrom] = useState(`${thisMonth()}-01`);
  const [to, setTo] = useState(todayISO());
  // Other filters: department (admin), class, only-low-attendance checkbox and search text.
  const [department, setDepartment] = useState("");
  const [classroom, setClassroom] = useState("");
  const [low, setLow] = useState(false);
  const [search, setSearch] = useState("");
  // busy = which download is running; open = the student whose yearly popup is open.
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  // Wait a moment after typing (debounce), then load dropdown options for departments (admin) and classes.
  const q = useDebounce(search);
  const depts = useOptions("/departments/", (d) => ({ value: d.id, label: d.name }), { is_active: "true" }, isAdmin);
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: isAdmin ? `${c.label} (${c.department_name || ""})` : c.label }), { is_active: "true", department }, true);

  // Query parameters sent to the API. Which date fields are sent depends on the chosen period.
  const params = {
    period, ...(period === "month" ? { month } : period === "year" ? { year } : { date_from: from, date_to: to }),
    department, classroom, search: q, low_only: low ? "1" : "",
  };
  // Table data (25 per page) and the summary numbers for the cards above the table.
  const list = usePaginated("/reports/student-records/", params, 25);
  const summary = useFetch("/reports/student-records/", { ...params, page_size: 1 });
  // Summary object used by the cards.
  const s = summary.data?.summary;

  // Handler for Download Excel / PDF: sends the same filters and saves the file. Empty filters are left out.
  const download = async (kind) => {
    setBusy(kind);
    try {
      await downloadExport("/reports/student-records/", Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "")), kind);
    } catch (e) {
      toast.error(e.response?.data instanceof Blob ? "Could not download. Choose a department or class and try again." : parseError(e).message);
    } finally {
      setBusy("");
    }
  };

  // Table column definitions.
  const columns = [
    // Roll number column
    { key: "roll_number", header: "Roll", className: "num nowrap" },
    // Student name column; shows an 'inactive' badge for inactive students
    { key: "name", header: "Student", render: (r) => <><strong>{r.name}</strong>{!r.is_active && <span className="badge"> inactive</span>}</> },
    // Department column is only for the admin
    ...(isAdmin ? [{ key: "department", header: "Department" }] : []),
    // Class column
    { key: "class_name", header: "Class", className: "nowrap" },
    // Present, absent and total lecture counts
    { key: "present", header: "Present", align: "right", className: "num" },
    { key: "absent", header: "Absent", align: "right", className: "num" },
    { key: "total", header: "Total", align: "right", className: "num" },
    // Attendance percentage column, or 'No lectures' if nothing was marked
    { key: "percentage", header: "Attendance", render: (r) => (r.total ? <Pct value={r.percentage} /> : <span className="muted">No lectures</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Student records"
        subtitle={isAdmin ? "Every student of the college: present, absent and attendance % for a month, a year or any dates. Click a student for the whole year, month by month." : "Every student of your department for a month, a year or any dates. Click a student for the whole year, month by month."}
        actions={<>
          <button className="btn secondary" disabled={!!busy} onClick={() => download("csv")}>{busy === "csv" ? "Preparing…" : "Download Excel"}</button>
          <button className="btn secondary" disabled={!!busy} onClick={() => download("pdf")}>{busy === "pdf" ? "Preparing…" : "Download PDF"}</button>
        </>}
      />
      {/* Summary cards (only after the summary has loaded). 'Below' uses the limit sent by the server. */}
      {s && (
        <div className="cards">
          <div className="stat"><div className="value">{s.students}</div><div className="label">Students</div></div>
          <div className="stat good"><div className="value">{fmtPct(s.percentage)}</div><div className="label">Attendance</div><div className="hint">{s.present} of {s.total} marks</div></div>
          <div className={`stat ${s.low ? "bad" : ""}`}><div className="value">{s.low}</div><div className="label">Below {summary.data.threshold}%</div></div>
          <div className="stat"><div className="value">{s.no_record}</div><div className="label">No lecture in period</div></div>
        </div>
      )}
      {/* Filters and the table. Rows with low attendance get the 'low-row' style. */}
      <div className="panel">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="rec-period">Show</label>
            <select id="rec-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="month">One month</option><option value="year">One year</option><option value="range">From date to date</option>
            </select>
          </div>
          {period === "month" && <div className="field"><label htmlFor="rec-month">Month</label><input id="rec-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>}
          {period === "year" && <div className="field"><label htmlFor="rec-y">Year</label><input id="rec-y" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} /></div>}
          {period === "range" && <>
            <div className="field"><label htmlFor="rec-from">From</label><input id="rec-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field"><label htmlFor="rec-to">To</label><input id="rec-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>}
          {isAdmin && <FilterSelect label="Department" value={department} onChange={(v) => { setDepartment(v); setClassroom(""); }} options={depts.options} allLabel="All departments" />}
          <FilterSelect label="Class" value={classroom} onChange={setClassroom} options={classes.options} allLabel="All classes" />
          <SearchInput value={search} onChange={setSearch} placeholder="Name or roll number" />
          <label className="check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Only below the limit</label>
        </div>
        <PagedTable
          query={list}
          columns={columns}
          rowKey="student"
          onRowClick={setOpen}
          rowClass={(r) => (r.low ? "low-row" : "")}
          emptyTitle="No students match"
          emptyHint="Change the period or the filters."
        />
      </div>
      {/* Yearly popup. The starting year comes from the chosen period. */}
      {open && <YearModal student={open} year={period === "year" ? year : period === "month" ? month.slice(0, 4) : from.slice(0, 4)} onClose={() => setOpen(null)} />}
    </>
  );
}
