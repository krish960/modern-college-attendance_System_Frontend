/*
  SubjectStudentsPage - choose which students take an elective subject.
  Opened by: Staff (menu: Who takes a subject).
  The teacher picks a subject + class, then unticks students who do not study it.
  Those students are left out of that subject's attendance list and percentage only.
  API endpoints used: GET /assignments/ (active), GET /subject-students/ (list for a class and subject),
  POST /subject-students/ (save one student's tick).
*/
import { useState } from "react";
import api from "../api/client";
import { ErrorNote, FilterSelect, Loading, PageHeader } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useFetch, useOptions } from "../hooks/useData";
import { parseError } from "../utils/errors";

/** Electives: tick off the students who do NOT study a subject. They disappear from that subject's attendance only. */
export default function SubjectStudentsPage() {
  // Toast (small message) helper.
  const toast = useToast();
  // Dropdown options: the teacher's active subject + class pairs (class and subject ids are kept for later calls).
  const assignments = useOptions("/assignments/", (a) => ({ value: a.id, label: `${a.subject_name} · ${a.classroom_name}`, classroom: a.classroom, subject: a.subject }), { is_active: "true" });
  // pick = the selected dropdown value; busy = id of the student whose tick is being saved (0 = none).
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(0);
  // Find the full option for the selected value, then load that class's students for the subject (only once something is chosen).
  const chosen = assignments.options.find((o) => String(o.value) === pick);
  const list = useFetch("/subject-students/", { classroom: chosen?.classroom, subject: chosen?.subject }, Boolean(chosen));

  // Handler for a checkbox: save whether this student takes the subject, then reload the list.
  const change = async (student, takes) => {
    setBusy(student.id);
    try {
      await api.post("/subject-students/", { classroom: chosen.classroom, subject: chosen.subject, student: student.id, takes_subject: takes });
      list.reload();
    } catch (e) {
      toast.error(parseError(e).message);
    } finally {
      setBusy(0);
    }
  };

  // Page layout
  return (
    <>
      <PageHeader
        title="Who takes this subject"
        subtitle="For an elective: untick a student who does not study the subject. He will not appear in that subject's attendance list, totals or percentage. His other subjects and any marks already saved are not changed."
      />
      {/* Subject picker, then the students table with a checkbox for each student */}
      <div className="panel">
        <div className="toolbar">
          <FilterSelect label="Subject and class" value={pick} onChange={setPick} options={assignments.options} allLabel="Choose…" />
        </div>
        {!chosen && <p className="muted pad">Choose a subject and class to see its students.</p>}
        {chosen && list.loading && !list.data && <Loading />}
        {chosen && list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {chosen && list.data && (
          <>
            <p className="pad"><strong>{list.data.taking}</strong> take this subject{list.data.not_taking > 0 && <>, <strong>{list.data.not_taking}</strong> do not</>}.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Roll</th><th>Name</th><th>Takes this subject</th></tr></thead>
                <tbody>
                  {list.data.students.map((s) => (
                    <tr key={s.id}>
                      <td className="num">{s.roll_number}</td>
                      <td>{s.name}</td>
                      <td>
                        <label className="row">
                          <input type="checkbox" checked={s.takes_subject} disabled={busy === s.id} onChange={(e) => change(s, e.target.checked)} />
                          {s.takes_subject ? "Yes" : <span className="muted">No, not in this subject</span>}
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
