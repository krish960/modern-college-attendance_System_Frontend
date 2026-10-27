/*
 * PromoteClassModal
 * What it is: a pop-up to ask for a whole class to move to the next class (needs HOD / admin approval).
 * Props: classRows (classes allowed as the OLD class), onClose, onDone (called when the request was sent and the user presses Done).
 * Used in: pages/StudentsPage.jsx.
 */
import { useEffect, useState } from "react";
import api from "../api/client";
import { parseError } from "../utils/errors";
import { Modal } from "./Modal";

/**
 * Start of a new year: ask to move a whole class to the next one (for example MSc I to MSc II).
 * This only SENDS A REQUEST. The HOD approves (a teacher's request), then the admin approves, and only then do the students move.
 *   1. pick the old class and the new class (the new class must be created first under Classes)
 *   2. untick the students who must stay behind (for example those who failed)
 *   3. "Send for approval": roll numbers and ID cards stay the same, old attendance stays with the old class
 * `classRows` = the classes the person may choose as the OLD class; the possible new classes come from the server.
 */
export function PromoteClassModal({ classRows, onClose, onDone }) {
  // from / to = chosen old and new class, students = active students of the old class, stay = ids of students who will NOT move.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [students, setStudents] = useState([]);
  const [stay, setStay] = useState(new Set()); // ids that stay behind
  // result = the answer from the server after sending, error = message to show, busy = request is running.
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [targets, setTargets] = useState([]); // the classes the old class can move to (loaded from the server)

  // Load the students of the old class whenever it changes.
  useEffect(() => {
    setStudents([]);
    setTargets([]);
    setStay(new Set());
    setTo("");
    setResult(null);
    if (!from) return;
    api.get("/students/", { params: { classroom: from, is_active: "true", page_size: 500 } })
      .then(({ data }) => setStudents(data.results))
      .catch((e) => setError(parseError(e).message));
    // A teacher teaches only the old class, so the possible new classes come from a separate call.
    api.get("/class-promotions/targets/", { params: { from } })
      .then(({ data }) => setTargets(data))
      .catch((e) => setError(parseError(e).message));
  }, [from]);

  // Tick or untick a student (add or remove their id in the `stay` set).
  const toggle = (id) => setStay((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // moving = how many students will move.
  const moving = students.length - stay.size;

  // Send the promotion request (this does not move anyone yet; it only asks for approval).
  const move = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/class-promotions/", { from_classroom: Number(from), to_classroom: Number(to), exclude: [...stay] });
      setResult(data);
    } catch (e) {
      setError(parseError(e).message);
    } finally {
      setBusy(false);
    }
  };

  // Pop-up: before sending it shows the form; after sending it shows the result.
  return (
    <Modal title="Promote a class to the next year (needs approval)" onClose={busy ? () => {} : (result ? onDone : onClose)} wide>
      <div className="modal-body">
        {/* Step 1: choose classes and students (hidden after the request is sent) */}
        {!result && (
          <>
            <p className="muted">
              Asks to move the students of one class into the next class together. Create the new class first under Classes. The HOD
              approves first (if a teacher asks), then the college admin. The students move only after the admin approves. Roll numbers
              and ID cards do not change, and past attendance stays with the old class.
            </p>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pr-from">Move students from</label>
                <select id="pr-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                  <option value="">Select…</option>
                  {classRows.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.academic_year})</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pr-to">Move students to</label>
                <select id="pr-to" value={to} onChange={(e) => setTo(e.target.value)} disabled={!from}>
                  <option value="">{from ? "Select…" : "Choose the old class first"}</option>
                  {targets.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.academic_year})</option>)}
                </select>
                {from && targets.length === 0 && <span className="help">There is no other class in this department yet. Create the new class first.</span>}
              </div>
            </div>
            {students.length > 0 && (
              <>
                <p className="small"><strong>{moving}</strong> of {students.length} students will move once approved. Untick a student to leave him in the old class.</p>
                <ul className="cards-list">
                  {students.map((s) => (
                    <li key={s.id}>
                      <label className="check" style={{ gridColumn: "1 / -1", fontWeight: 400 }}>
                        <input type="checkbox" checked={!stay.has(s.id)} onChange={() => toggle(s.id)} />
                        <span className="roll">{s.roll_number}</span> <span>{s.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {/* Step 2: confirmation after sending */}
        {result && (
          <div className="import-result" role="status">
            <div><span className="badge good">Request sent</span> to move {result.from_name} to {result.to_name}.</div>
            <div>{result.status === "WAITING_HOD" ? "Next: your HOD approves, then the college admin." : "Next: the college admin approves. The students move after that."}</div>
            <div className="muted small">You can follow it under Class promotions.</div>
          </div>
        )}
      </div>
      <div className="modal-foot">
        {result ? <button className="btn" onClick={onDone}>Done</button> : (
          <>
            <button className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn" onClick={move} disabled={busy || !from || !to || moving < 1}>{busy ? "Sending…" : "Send for approval"}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
