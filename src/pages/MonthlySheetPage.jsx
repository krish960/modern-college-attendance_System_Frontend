/*
 * Monthly attendance sheet page. Opened by the Admin, the HOD and the Teacher.
 * Shows the class register for one month: one row per student, one column per
 * submitted lecture, with P (present) or A (absent) in each cell.
 * Data: GET /api/reports/monthly-sheet/. Can be exported as CSV or PDF.
 * The server limits the classes a user can pick to what they are allowed to see.
 */

import { useMemo, useState } from "react";
import { ErrorNote, FilterSelect, Loading, PageHeader, SearchInput } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useFetch, useOptions } from "../hooks/useData";
import { downloadExport } from "../utils/download";
import { parseError } from "../utils/errors";
import { byRoll } from "../utils/format";

// Current month as "YYYY-MM", the format a month input uses.
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** The paper register for one class and month: a row per student, a column per submitted lecture, P / A in the cells. */
export default function MonthlySheetPage() {
  const toast = useToast();
  // Filters. The month starts on this month.
  const [f, setF] = useState({ classroom: "", subject: "", month: thisMonth() });
  // Text typed in the Find student box (filters the rows already loaded, no server call).
  const [find, setFind] = useState("");
  // Which export is running ("csv", "pdf" or "").
  const [exporting, setExporting] = useState("");
  // Returns a handler that updates one filter value.
  const set = (key) => (value) => setF((old) => ({ ...old, [key]: value }));
  // Dropdown choices for the class and subject filters.
  const classes = useOptions("/classes/", (c) => ({ value: c.id, label: c.label }), undefined);
  const subjects = useOptions("/subjects/", (s) => ({ value: s.id, label: s.name }), undefined);
  // Loads the sheet. It waits until a class and a month are chosen (last argument).
  const sheet = useFetch("/reports/monthly-sheet/", f, Boolean(f.classroom && f.month));
  const data = sheet.data;

  // Rows shown: sorted by roll number and cut down by the Find box (name or roll number).
  const rows = useMemo(() => {
    const t = find.trim().toLowerCase();
    const list = [...(data?.results || [])].sort(byRoll);
    return t ? list.filter((r) => r.name.toLowerCase().includes(t) || String(r.roll_number).toLowerCase().includes(t)) : list;
  }, [data, find]);

  // Download the sheet as CSV or PDF using the current filters.
  const exportAs = async (kind) => {
    setExporting(kind);
    try {
      await downloadExport("/reports/monthly-sheet/", f, kind);
    } catch (e) {
      toast.error(e.response?.data instanceof Blob ? "Could not export." : parseError(e).message);
    } finally {
      setExporting("");
    }
  };

  // True when the user has chosen enough to show a sheet. Export buttons use it.
  const ready = f.classroom && f.month;
  return (
    <>
      {/* Page title. Export buttons appear only once a sheet is on screen. */}
      <PageHeader
        title="Monthly attendance sheet"
        subtitle="The class register for a month, built from submitted lectures. P is present, A is absent."
        actions={ready && data && (
          <>
            <button className="btn secondary" onClick={() => exportAs("xlsx")} disabled={Boolean(exporting)}>Export Excel</button>
            <button className="btn secondary" onClick={() => exportAs("csv")} disabled={Boolean(exporting)}>Export CSV</button>
            <button className="btn secondary" onClick={() => exportAs("pdf")} disabled={Boolean(exporting)}>Export PDF</button>
          </>
        )}
      />
      {/* Card with filters and the register. */}
      <div className="panel">
        {/* Toolbar with find box, class, subject and month. */}
        <div className="toolbar">
          <SearchInput id="sheet-find" label="Find student" value={find} onChange={setFind} placeholder="Roll number or name" />
          <FilterSelect label="Class" value={f.classroom} onChange={set("classroom")} options={classes.options} allLabel="Choose a class" />
          <FilterSelect label="Subject" value={f.subject} onChange={set("subject")} options={subjects.options} allLabel="All subjects" />
          <div className="field">
            <label htmlFor="sheet-month">Month</label>
            <input id="sheet-month" type="month" value={f.month} onChange={(e) => set("month")(e.target.value)} />
          </div>
        </div>

        {!f.classroom ? (
          // Nothing chosen yet.
          <div className="empty"><h3>Choose a class</h3><p>Pick a class and a month to see the register.</p></div>
        ) : sheet.loading && !data ? (
          // First load.
          <Loading />
        ) : sheet.error ? (
          // Server or network error.
          <ErrorNote message={sheet.error} onRetry={sheet.reload} />
        ) : data && data.columns.length === 0 ? (
          // The month has no submitted lectures, so there are no columns.
          <div className="empty"><h3>No submitted lectures in {data.month_label}</h3><p>Lectures appear here once the teacher has submitted attendance for them.</p></div>
        ) : data && (
          // Normal case: the register.
          <>
            {/* The server stops at a maximum number of lectures, so warn when the list was cut. */}
            {data.truncated && <p className="alert-note" role="status">Only the first lectures of the month are shown. Choose a subject to narrow it down.</p>}
            {/* Scrollable area. The Roll and Student columns stay fixed (sticky) while the rest scrolls sideways. */}
            <div className="sheet-wrap">
              <table className="sheet" aria-label={`Attendance sheet for ${data.classroom}, ${data.month_label}`}>
                {/* Heading row: one column per lecture, then the totals. */}
                <thead>
                  <tr>
                    <th className="sticky-a">Roll</th>
                    <th className="sticky-b">Student</th>
                    {/* Lecture columns. Day of month and subject code. Hover shows full details. */}
                    {data.columns.map((c) => (
                      <th key={c.id} className="cell" title={`${c.date}, ${c.start}-${c.end}\n${c.subject}\n${c.teacher}`}>
                        {String(c.day).padStart(2, "0")}
                        <small>{c.subject_code}</small>
                      </th>
                    ))}
                    <th className="tot">P</th>
                    <th className="tot">Total</th>
                    <th className="tot">%</th>
                  </tr>
                </thead>
                {/* Student rows. */}
                <tbody>
                  {rows.map((r) => (
                    // Students below the attendance limit get a shaded row.
                    <tr key={r.student} className={r.low ? "low-row" : ""}>
                      <td className="sticky-a num"><strong>{r.roll_number}</strong></td>
                      <td className="sticky-b">{r.name}{!r.is_active && <span className="badge"> Inactive</span>}</td>
                      {/* One cell per lecture: P, A or empty if the student was not marked for that lecture. */}
                      {data.columns.map((c) => {
                        const v = r.marks[String(c.id)];
                        return <td key={c.id} className={`cell ${v === "P" ? "p" : v === "A" ? "a" : ""}`}>{v || ""}</td>;
                      })}
                      <td className="tot num">{r.present}</td>
                      <td className="tot num">{r.total}</td>
                      <td className="tot num">{r.percentage === null ? "–" : `${r.percentage}%`}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={data.columns.length + 5} className="muted" style={{ padding: "1rem" }}>No student matches "{find}".</td></tr>}
                </tbody>
                {/* Footer row: how many students were present in each lecture. */}
                <tfoot>
                  <tr>
                    <td className="sticky-a" />
                    <td className="sticky-b"><strong>Present in lecture</strong></td>
                    {data.columns.map((c) => <td key={c.id} className="cell num">{c.present}</td>)}
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Help text under the table. */}
            <p className="muted small" style={{ padding: "0.6rem 1rem" }}>Hover a column heading to see the date, time, subject and teacher. Students under {data.threshold}% are shaded.</p>
          </>
        )}
      </div>
    </>
  );
}
