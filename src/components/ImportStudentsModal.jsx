/*
 * ImportStudentsModal
 * What it is: a pop-up to add many students at once from a CSV file, in two steps: "Check file" (nothing is saved) and then "Import".
 * Props: classes (list of {value, label}), onClose, onImported(result) (called after a real import).
 * Used in: pages/StudentsPage.jsx.
 */
import { useState } from "react";
import api from "../api/client";
import { parseError } from "../utils/errors";
import { Modal } from "./Modal";

// Example CSV text offered as a download and shown on screen. Columns: roll_number, name, member_id.
const SAMPLE = "roll_number,name,member_id\n101,Amit Jadhav,018822\n102,Priya Shinde,018823\n103,Rohan Kulkarni,018824\n";

/** Two steps: "Check file" (dry run, nothing saved) then "Import". */
export function ImportStudentsModal({ classes, onClose, onImported }) {
  // classroom = chosen class, file = chosen CSV file, report = result of the last check, error = message, busy = request running.
  const [classroom, setClassroom] = useState("");
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Send the class and the CSV file to the server. dryRun true = only check and show a report; false = really import.
  // The server does the reading of the CSV.
  const send = async (dryRun) => {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("classroom", classroom);
      body.append("file", file);
      body.append("dry_run", dryRun ? "true" : "false");
      const { data } = await api.post("/students/import/", body);
      if (dryRun) setReport(data);
      else onImported(data);
    } catch (e) {
      setReport(null);
      setError(parseError(e).message);
    } finally {
      setBusy(false);
    }
  };

  // Wraps a setter so that changing the class or file clears the old report and error (the old check no longer fits).
  const change = (setter) => (value) => {
    setter(value);
    setReport(null);
    setError("");
  };

  // A data: link so the sample file can be downloaded without asking the server.
  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`;
  // ready = both a class and a file are chosen.
  const ready = classroom && file;

  // Pop-up: instructions, sample, class and file inputs, the check report, then the buttons.
  return (
    <Modal title="Import students from CSV" onClose={busy ? () => {} : onClose} wide>
      <div className="modal-body">
        <p className="muted">
          One row per student with the columns <strong>roll_number</strong> and <strong>name</strong>, and, if you want to scan the ID
          cards, <strong>member_id</strong> (the number printed on the card, the same one its barcode holds). Roll numbers that already
          exist in the class are skipped and never changed; if such a student has no card yet, his member_id is added.
        </p>
        <p className="muted small">
          In Excel, format the member_id column as <strong>Text</strong> before typing it, otherwise Excel drops the leading zero
          (018822 becomes 18822) and the scanned card will not match. Save as <strong>CSV UTF-8</strong>.
        </p>
        {/* Sample CSV */}
        <pre className="sample">{SAMPLE.trim()}</pre>
        <p><a href={sampleHref} download="students-sample.csv">Download a sample file</a></p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="imp-class">Class <span className="req" aria-hidden="true">*</span></label>
            <select id="imp-class" value={classroom} onChange={(e) => change(setClassroom)(e.target.value)}>
              <option value="">Select…</option>
              {classes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="imp-file">CSV file <span className="req" aria-hidden="true">*</span></label>
            <input id="imp-file" type="file" accept=".csv,text/csv" onChange={(e) => change(setFile)(e.target.files?.[0] || null)} />
          </div>
        </div>
        {/* Report from "Check file": counts and the problem rows (invalid, card problems, skipped) */}
        {report && (
          <div className="import-result" role="status">
            <div>
              <span className="badge good">{report.created} will be registered</span>{" "}
              <span className="badge info">{report.cards_linked} ID card{report.cards_linked === 1 ? "" : "s"} will be linked</span>{" "}
              <span className="badge">{report.skipped.length} skipped</span>{" "}
              <span className={`badge ${report.invalid.length ? "bad" : ""}`}>{report.invalid.length} invalid</span>
            </div>
            {report.invalid.length > 0 && (
              <div>
                <strong>Fix these rows (they will not be imported):</strong>
                <ul>{report.invalid.map((r) => <li key={r.line}>Line {r.line}: {r.error}</li>)}</ul>
              </div>
            )}
            {report.card_problems.length > 0 && (
              <div>
                <strong>ID card numbers that will not be linked (the students are still registered):</strong>
                <ul>{report.card_problems.map((r, i) => <li key={i}>Line {r.line}, roll {r.roll_number}, {r.card}: {r.reason}</li>)}</ul>
              </div>
            )}
            {report.skipped.length > 0 && (
              <div>
                <strong>Skipped:</strong>
                <ul>{report.skipped.map((r) => <li key={r.line}>Line {r.line}, roll {r.roll_number}: {r.reason}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Import is possible only after a check that found something to add */}
      <div className="modal-foot">
        <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn secondary" onClick={() => send(true)} disabled={!ready || busy}>Check file</button>
        <button type="button" className="btn" onClick={() => send(false)} disabled={!ready || busy || !report || (report.created === 0 && report.cards_linked === 0)}>
          {busy ? "Working…" : report ? (report.created === 0 ? "Add the ID card numbers" : `Import ${report.created} student${report.created === 1 ? "" : "s"}`) : "Import"}
        </button>
      </div>
    </Modal>
  );
}
