/*
  StaffAttendancePage - attendance of the teachers (not students).
  Opened by: HOD (can mark) and Admin (read-only, must pick a department first).
  Two views: "One day" (mark by hand or scan ID cards) and "Month sheet" (grid with totals, export to CSV/PDF).
  API endpoints used: GET /departments/ (admin only), GET /staff-attendance/day/,
  GET /staff-attendance/monthly/ (also used for export), POST /staff-attendance/mark/.
*/
import { useMemo, useState } from "react";
import api from "../api/client";
import { DataTable } from "../components/DataTable";
import ScanPanel from "../components/ScanPanel";
import { ErrorNote, FilterSelect, Loading, PageHeader, StatCard, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useFetch, useOptions } from "../hooks/useData";
import { downloadExport } from "../utils/download";
import { parseError } from "../utils/errors";
import { fmtDateTime, todayISO } from "../utils/format";

// Text shown for how a mark was made (checked in, HOD, ID scan, ...).
const SOURCE = { SELF: "Checked in", HOD: "HOD", SCAN: "ID scan", LECTURE: "Took a lecture", LEAVEREQ: "Approved leave" };
// Mark buttons: [status value, short letter, label].
const BUTTONS = [
  ["PRESENT", "P", "Present"],
  ["LATE", "L", "Late"],
  ["HALF_DAY", "H", "Half day"],
  ["ABSENT", "A", "Absent"],
  ["LEAVE", "V", "On leave"],
];
// Current month as YYYY-MM.
const thisMonth = () => todayISO().slice(0, 7);

/** The HOD's staff attendance: one day (mark by hand or scan ID cards) and the month sheet. Admin sees it read-only. */
export default function StaffAttendancePage() {
  // Logged-in user, toast helper, and a flag for the HOD role.
  const { user } = useAuth();
  const toast = useToast();
  const isHod = user.role === "HOD";
  // Page state: chosen department (admin), chosen day, month, current view and which export is running.
  const [department, setDepartment] = useState("");
  const [day, setDay] = useState(todayISO());
  const [month, setMonth] = useState(thisMonth());
  const [view, setView] = useState("day");
  const [exporting, setExporting] = useState("");
  // Department dropdown options, loaded only for the admin.
  const depts = useOptions("/departments/", (d) => ({ value: d.id, label: d.name }), undefined, !isHod);
  // HOD is limited to their own department by the server; admin must send the chosen department.
  const scope = isHod ? {} : { department };
  const ready = isHod || Boolean(department);
  // Load the day list or the month sheet from the API. Each loads only when its view is open and the department is known.
  const dayData = useFetch("/staff-attendance/day/", { date: day, ...scope }, ready && view === "day");
  const monthData = useFetch("/staff-attendance/monthly/", { month, ...scope }, ready && view === "month");
  // Teacher rows for the chosen day.
  const rows = dayData.data?.results || [];

  // Save one mark on the server, then reload the day list.
  const mark = async (teacher, status, extra = {}) => {
    const { data } = await api.post("/staff-attendance/mark/", { user: teacher, status, date: day, ...extra });
    dayData.reload();
    return data;
  };
  // Handler for the P/L/H/A/V buttons: mark the teacher and show a toast (message).
  const setStatus = async (teacher, status) => {
    try {
      await mark(teacher.user, status);
      toast.success(`${teacher.name}: ${BUTTONS.find((b) => b[0] === status)[2]}`);
    } catch (e) {
      toast.error(parseError(e).message);
    }
  };

  // The scan panel talks in "students"; a teacher is shown the same way (staff ID in place of the roll number).
  // The scan panel expects students, so each teacher is converted to the same shape (staff ID shown as roll number).
  const people = useMemo(() => rows.map((r) => ({ id: r.user, name: r.name, roll_number: r.employee_id || "–", card_code: r.card_code, is_active: true })), [rows]);
  // Teachers already counted as present (present, late or half day); the scan panel uses this to show who is done.
  const marks = useMemo(() => Object.fromEntries(rows.filter((r) => ["PRESENT", "LATE", "HALF_DAY"].includes(r.status)).map((r) => [r.user, "PRESENT"])), [rows]);
  // Handler when an ID card is scanned: mark the teacher (status AUTO) and report if nothing changed.
  const scanned = async (id) => {
    const data = await mark(id, "AUTO", { scan: true });
    return data.unchanged ? "unchanged" : "ok";
  };

  // Handler for Export CSV / PDF buttons: download the month sheet file.
  const exportAs = async (kind) => {
    setExporting(kind);
    try {
      await downloadExport("/staff-attendance/monthly/", { month, ...scope }, kind);
    } catch (e) {
      toast.error(e.response?.data instanceof Blob ? "Could not export." : parseError(e).message);
    } finally {
      setExporting("");
    }
  };

  // Table columns for the day view.
  const columns = [
    // Staff ID column
    { key: "employee_id", header: "Staff ID", render: (r) => r.employee_id || <span className="muted">–</span> },
    // Teacher name column
    { key: "name", header: "Teacher", render: (r) => <strong>{r.name}</strong> },
    {
      // Status column: badge, how it was marked and the check-in time, or 'Not marked'
      key: "status",
      header: "Status",
      render: (r) => (r.status ? <><StatusBadge status={r.status} /> <span className="muted small">{SOURCE[r.source]}{r.check_in_at ? `, ${fmtDateTime(r.check_in_at).split(", ").pop()}` : ""}</span></> : <span className="muted small">Not marked</span>),
    },
    // Mark column with the buttons; only the HOD sees it
    ...(isHod
      ? [{
          key: "set",
          header: "Mark",
          align: "right",
          render: (r) => (
            <span className="marks">
              {BUTTONS.map(([value, letter, label]) => (
                <button key={value} type="button" className={`tick ${value === "ABSENT" ? "a" : "p"} ${r.status === value ? "on" : ""}`} aria-pressed={r.status === value} aria-label={`${r.name}: ${label}`} title={label} onClick={() => setStatus(r, value)}>{letter}</button>
              ))}
            </span>
          ),
        }]
      : []),
  ];

  // Month sheet data
  const sheet = monthData.data;
  return (
    <>
      <PageHeader
        title="Staff attendance"
        subtitle={isHod ? "Teachers can check in themselves, you can scan their ID cards, or mark by hand. A teacher who submits a lecture is marked present automatically." : "Read-only view of a department's teachers."}
        actions={view === "month" && sheet && (
          <>
            <button className="btn secondary" onClick={() => exportAs("csv")} disabled={Boolean(exporting)}>Export CSV</button>
            <button className="btn secondary" onClick={() => exportAs("pdf")} disabled={Boolean(exporting)}>Export PDF</button>
          </>
        )}
      />
      {/* Toolbar: department (admin), day/month switch, and date or month picker */}
      <div className="panel">
        <div className="toolbar">
          {!isHod && <FilterSelect label="Department" value={department} onChange={setDepartment} options={depts.options} allLabel="Choose a department" />}
          <div className="role-toggle" role="radiogroup" aria-label="View">
            <button type="button" role="radio" aria-checked={view === "day"} className={view === "day" ? "on" : ""} onClick={() => setView("day")}>One day</button>
            <button type="button" role="radio" aria-checked={view === "month"} className={view === "month" ? "on" : ""} onClick={() => setView("month")}>Month sheet</button>
          </div>
          {view === "day" ? (
            <div className="field"><label htmlFor="sa-day">Date</label><input id="sa-day" type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value || todayISO())} /></div>
          ) : (
            <div className="field"><label htmlFor="sa-month">Month</label><input id="sa-month" type="month" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} /></div>
          )}
        </div>

        {!ready ? (
          <div className="empty"><h3>Choose a department</h3></div>
        ) : view === "day" ? (
          !dayData.data && !dayData.error ? <Loading /> : dayData.error ? <ErrorNote message={dayData.error} onRetry={dayData.reload} /> : (
            <>
              {/* Summary cards for the day */}
              <div className="cards" style={{ padding: "1rem 1rem 0" }}>
                <StatCard label="Present" value={dayData.data.summary.present} tone="good" />
                <StatCard label="Late" value={dayData.data.summary.late} />
                <StatCard label="Absent / leave" value={dayData.data.summary.absent + dayData.data.summary.leave} />
                <StatCard label="Not marked" value={dayData.data.summary.not_marked} />
              </div>
              {isHod && rows.length > 0 && <div style={{ padding: "1rem" }}><ScanPanel students={people} marks={marks} onPresent={scanned} title="Scan staff ID cards" help="Hold a teacher's ID card in front of the camera to mark them present for this date. Register each teacher's card once under Staff." noun="teacher" /></div>}
              <DataTable columns={columns} rows={rows} rowKey="user" emptyTitle="No teachers in this department" emptyHint="Register teachers under Staff first." />
            </>
          )
        ) : !sheet && !monthData.error ? <Loading /> : monthData.error ? <ErrorNote message={monthData.error} onRetry={monthData.reload} /> : (
          <div className="sheet-wrap">
            <table className="sheet" aria-label={`Staff attendance, ${sheet.month_label}`}>
              <thead>
                <tr>
                  <th className="sticky-a">Staff ID</th>
                  <th className="sticky-b">Teacher</th>
                  {sheet.days.map((d, i) => <th key={d} className="cell" title={sheet.weekdays[i]}>{String(d).padStart(2, "0")}<small>{sheet.weekdays[i]}</small></th>)}
                  <th className="tot">P</th><th className="tot">L</th><th className="tot">A</th><th className="tot">Leave</th>
                </tr>
              </thead>
              <tbody>
                {sheet.results.map((r) => (
                  <tr key={r.user}>
                    <td className="sticky-a num"><strong>{r.employee_id || "–"}</strong></td>
                    <td className="sticky-b">{r.name}</td>
                    {sheet.days.map((d) => {
                      const v = r.marks[String(d)];
                      return <td key={d} className={`cell ${v === "P" || v === "L" ? "p" : v === "A" ? "a" : ""}`}>{v || ""}</td>;
                    })}
                    <td className="tot num">{r.present}</td><td className="tot num">{r.late}</td><td className="tot num">{r.absent}</td><td className="tot num">{r.leave}</td>
                  </tr>
                ))}
                {sheet.results.length === 0 && <tr><td colSpan={sheet.days.length + 6} className="muted" style={{ padding: "1rem" }}>No teachers in this department.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {view === "month" && sheet && <p className="muted small" style={{ padding: "0.6rem 1rem" }}>P present, L late (counted as present), H half day, A absent, V on leave. Blank means not recorded. Half days count as 0.5 in the P total.</p>}
      </div>
    </>
  );
}
