/*
 * Lecture page (attendance register). Opened from the Teacher dashboard, the take attendance
 * page and lecture history, so Teacher, HOD and Admin can reach it.
 * The teacher who owns a draft lecture marks Present or Absent per student here.
 * Everyone else sees it read-only. Submitted marks change only by a correction request.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import ScanPanel from "../components/ScanPanel";
import StudentPhoto from "../components/StudentPhoto";
import { FormModal } from "../components/FormModal";
import { ConfirmDialog } from "../components/Modal";
import { ErrorNote, Loading, PageHeader, SearchInput, StatusBadge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAction } from "../hooks/useAction";
import { useFetch } from "../hooks/useData";
import { byRoll, fmtDate, fmtTime } from "../utils/format";

/**
 * One lecture. For the teacher who owns a DRAFT lecture it is the attendance register
 * (Present / Absent per student). Everyone else, and submitted lectures, see it read-only.
 * Changing submitted attendance is only possible through a correction request.
 */
export default function LecturePage() {
  // id is the lecture id from the URL (/lectures/:id).
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  // run() wraps a request with a toast and sets busy while it runs.
  const { run, busy } = useAction();
  // Lecture details plus its students and any saved marks (GET /api/lectures/{id}/roster/). 'editable' comes from the server.
  const roster = useFetch(`/lectures/${id}/roster/`);
  const lecture = roster.data?.lecture;
  // Once submitted, marks are locked and read from the attendance records instead.
  const submitted = lecture?.status === "SUBMITTED";
  // Saved attendance records of a submitted lecture (GET /api/attendance-records/). Needed for the 'Request correction' buttons.
  const records = useFetch("/attendance-records/", { lecture: id, page_size: 200 }, Boolean(submitted));

  // Current marks by student id: { studentId: 'PRESENT' or 'ABSENT' }. A student with no entry is not marked yet.
  const [marks, setMarks] = useState({});
  // True when marks changed since the last save. It enables the 'Save draft' button.
  const [dirty, setDirty] = useState(false);
  // Open popup: { type: 'submit' | 'cancel' | 'correct', record? } or null.
  const [modal, setModal] = useState(null);
  // Text typed in the student search box.
  const [find, setFind] = useState("");

  useEffect(() => {
    // Each time the roster loads, start the marks from what the server has saved.
    if (!roster.data) return;
    const initial = {};
    roster.data.students.forEach((s) => {
      if (s.status) initial[s.id] = s.status;
    });
    setMarks(initial);
    setDirty(false);
  }, [roster.data]);

  // Students sorted by roll number.
  const students = useMemo(() => [...(roster.data?.students || [])].sort(byRoll), [roster.data]);
  // Students that match the search text (name or roll number).
  const visible = useMemo(() => {
    const t = find.trim().toLowerCase();
    return t ? students.filter((s) => s.name.toLowerCase().includes(t) || String(s.roll_number).toLowerCase().includes(t)) : students;
  }, [students, find]);
  // Only the owner teacher of a draft lecture on an allowed date gets editable = true.
  const editable = Boolean(roster.data?.editable);
  // Counts of present and absent marks shown in the footer.
  const tally = useMemo(() => {
    const values = Object.values(marks);
    return { present: values.filter((v) => v === "PRESENT").length, absent: values.filter((v) => v === "ABSENT").length };
  }, [marks]);
  // Students with no mark yet. Submit stays disabled until this is 0.
  const unmarked = students.length - tally.present - tally.absent;

  // Look up a saved record by student id, to know the record id and if a correction is already pending.
  const recordByStudent = useMemo(() => {
    const map = {};
    (records.data?.results || []).forEach((r) => (map[r.student] = r));
    return map;
  }, [records.data]);

  if (roster.loading && !roster.data) return <Loading />;
  if (roster.error) return <ErrorNote message={roster.error} onRetry={roster.reload} />;

  // Mark one student.
  const setMark = (studentId, status) => {
    setMarks((m) => ({ ...m, [studentId]: status }));
    setDirty(true);
  };
  // Mark every student with the same status (used for 'Mark all present').
  const markAll = (status) => {
    const all = {};
    students.forEach((s) => (all[s.id] = status));
    setMarks(all);
    setDirty(true);
  };
  // Only fills students who have no mark yet. Marks already chosen are kept.
  const markRemainingAbsent = () => {
    setMarks((m) => {
      const next = { ...m };
      students.forEach((s) => { if (!next[s.id]) next[s.id] = "ABSENT"; });
      return next;
    });
    setDirty(true);
  };
  // Body sent to the server: a list of { student, status }.
  const payload = () => ({ records: Object.entries(marks).map(([student, status]) => ({ student: Number(student), status })) });

  // Saves the marks without submitting. The lecture stays a DRAFT and can still be changed.
  const saveDraft = () =>
    run(async () => {
      await api.post(`/lectures/${id}/mark/`, payload());
      roster.reload();
    }, "Draft saved");

  // A draft lecture can be cancelled by the HOD, or by the teacher who can edit it.
  const canCancel = lecture.status === "DRAFT" && (user.role === "HOD" || (user.role === "STAFF" && roster.data.editable));
  // Teachers only reach this page for their own lectures, so STAFF means owner here.
  const isOwner = user.role === "STAFF";

  // Letter read aloud by screen readers next to each row.
  const statusLabel = (s) => (s === "PRESENT" ? "P" : s === "ABSENT" ? "A" : "");

  return (
    <>
      {/* Header with a back link (teacher to take attendance, HOD and Admin to history) and the Cancel lecture button. */}
      <PageHeader
        title="Attendance register"
        subtitle={
          <Link to={user.role === "STAFF" ? "/attendance" : "/history"}>← Back to {user.role === "STAFF" ? "take attendance" : "lecture history"}</Link>
        }
        actions={canCancel && <button className="btn secondary" onClick={() => setModal({ type: "cancel" })}>Cancel lecture</button>}
      />

      {/* Status notes: cancelled, draft that cannot be edited, and submitted (locked). */}
      {lecture.status === "CANCELLED" && <div className="note warn" style={{ marginBottom: "1rem" }}>This lecture was cancelled. No attendance is recorded.</div>}
      {lecture.status === "DRAFT" && !editable && (
        <div className="note info" style={{ marginBottom: "1rem" }}>
          {user.role === "STAFF" ? "This lecture is still a draft but cannot be edited now (future date or inactive assignment)." : "The teacher has not submitted attendance for this lecture yet."}
        </div>
      )}
      {submitted && (
        <div className="note info" style={{ marginBottom: "1rem" }}>
          Submitted {lecture.submitted_by_name ? `by ${lecture.submitted_by_name}` : ""}. Submitted attendance is locked; {isOwner ? "use Request correction to change a mark." : "changes go through a correction request from the teacher."}
        </div>
      )}

      {/* Attendance register: lecture details, student rows and footer. */}
      <section className="register" aria-label="Attendance register">
        {/* Lecture details: subject, class, date and time, teacher, status. */}
        <div className="register-head">
          <div>
            <h2>{lecture.subject_name}</h2>
            <div className="muted">{lecture.classroom_name}</div>
          </div>
          <div>
            <div>{fmtDate(lecture.lecture_date)}, {fmtTime(lecture.start_time)}–{fmtTime(lecture.end_time)}</div>
            <div className="muted">{lecture.teacher_name}</div>
          </div>
          <div><StatusBadge status={lecture.status} /></div>
        </div>

        {/* Left: ID card scan panel (editable only). Right: the list of students. */}
        <div className={`register-split ${editable && students.length > 0 ? "has-scan" : ""}`}>
        {editable && students.length > 0 && <div className="register-scan"><ScanPanel students={students} marks={marks} onPresent={(id) => setMark(id, "PRESENT")} /></div>}
        <div className="register-list">
        {/* Search box, only shown for long classes. */}
        {students.length > 8 && (
          <div className="toolbar" style={{ borderBottom: "1px solid var(--line-soft)" }}>
            <SearchInput id="register-find" label="Find student" value={find} onChange={setFind} placeholder="Roll number or name" />
          </div>
        )}
        {/* Empty class message, or the student rows. */}
        {!students.length ? (
          <div className="empty">
            <h3>No students in this class</h3>
            <p>Register students in this class first, then come back to take attendance.</p>
            <Link className="btn" to="/students">Go to students</Link>
          </div>
        ) : (
          // the roll-number column keeps its usual width and only gets wider when a roll number is long (over 6 characters)
          <div role="list" className="register-rows" style={students.some((x) => String(x.roll_number).length > 6) ? { "--roll-col": "6.5rem", "--roll-col-phone": "4.6rem" } : undefined}>
            {visible.length === 0 && <p className="muted" style={{ padding: "1rem" }}>No student matches "{find}".</p>}
            {/* One row per student. Editable: P and A buttons. Otherwise: a badge, plus a correction button for the teacher on a submitted lecture. */}
            {visible.map((s) => {
              const status = marks[s.id] || null;
              const record = recordByStudent[s.id];
              return (
                <div role="listitem" key={s.id} className={`register-line ${status === "ABSENT" ? "is-absent" : ""}`}>
                  <span className={`roll ${String(s.roll_number).length > 7 ? "long" : ""}`}>{s.roll_number}</span>
                  <span className="name">
                    <span className="with-avatar"><StudentPhoto student={s} size={26} /> {s.name}</span> {!s.is_active && <span className="badge">Inactive</span>}
                  </span>
                  <span className="marks">
                    {editable ? (
                      <>
                        <button type="button" className={`tick p ${status === "PRESENT" ? "on" : ""}`} aria-pressed={status === "PRESENT"} aria-label={`${s.name}: present`} onClick={() => setMark(s.id, "PRESENT")}>P</button>
                        <button type="button" className={`tick a ${status === "ABSENT" ? "on" : ""}`} aria-pressed={status === "ABSENT"} aria-label={`${s.name}: absent`} onClick={() => setMark(s.id, "ABSENT")}>A</button>
                      </>
                    ) : (
                      <>
                        {status ? <StatusBadge status={status} /> : <span className="muted small">Not marked</span>}
                        {submitted && isOwner && record && (
                          record.has_pending_correction ? (
                            <span className="badge warn">Correction pending</span>
                          ) : (
                            <button className="btn ghost sm" onClick={() => setModal({ type: "correct", record })}>Request correction</button>
                          )
                        )}
                      </>
                    )}
                    <span className="sr-only">{statusLabel(status)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        </div>
        </div>

        {students.length > 0 && (
          // Footer: counts and the action buttons (editable lectures only).
          <div className="register-foot">
            <span className="tally">
              <b className="p">{tally.present}</b> present · <b className="a">{tally.absent}</b> absent{editable && <> · <b>{unmarked}</b> not marked</>}
            </span>
            <span className="spacer" />
            {editable && (
              <>
                <button className="btn secondary sm" onClick={() => markAll("PRESENT")} disabled={busy}>Mark all present</button>
                {unmarked > 0 && tally.present > 0 && <button className="btn secondary sm" onClick={markRemainingAbsent} disabled={busy}>Mark remaining absent</button>}
                <button className="btn secondary" onClick={saveDraft} disabled={busy || !dirty}>Save draft</button>
                <button className="btn" onClick={() => setModal({ type: "submit" })} disabled={busy || unmarked > 0}>Submit attendance</button>
              </>
            )}
          </div>
        )}
      </section>
      {editable && unmarked > 0 && <p className="muted small" style={{ marginTop: "0.6rem" }}>Mark every student to enable Submit. {unmarked} left.</p>}

      {/* Confirm submit (POST /api/lectures/{id}/submit/). After this the marks are locked. */}
      {modal?.type === "submit" && (
        <ConfirmDialog
          title="Submit attendance?"
          message={`${tally.present} present and ${tally.absent} absent. After submitting you cannot edit these marks directly; you would need to send a correction request to your HOD.`}
          confirmLabel="Submit attendance"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await api.post(`/lectures/${id}/submit/`, payload());
            setModal(null);
            toast.success("Attendance submitted");
            roster.reload();
          }}
        />
      )}
      {/* Confirm cancel with a reason (POST /api/lectures/{id}/cancel/). */}
      {modal?.type === "cancel" && (
        <ConfirmDialog
          title="Cancel this lecture?"
          message="It will be marked Cancelled and will no longer count as pending."
          confirmLabel="Cancel lecture"
          danger
          remarksLabel="Reason"
          onCancel={() => setModal(null)}
          onConfirm={async (reason) => {
            await api.post(`/lectures/${id}/cancel/`, { reason });
            setModal(null);
            toast.success("Lecture cancelled");
            roster.reload();
          }}
        />
      )}
      {/* Correction request form (POST /api/corrections/). The HOD approves it. The mark changes only after approval. */}
      {modal?.type === "correct" && (
        <FormModal
          title={`Request correction: ${modal.record.student_name}`}
          intro={`Currently ${modal.record.status === "PRESENT" ? "Present" : "Absent"}. Your HOD will review the request; the mark changes only if it is approved.`}
          fields={[
            {
              name: "requested_status",
              label: "Change to",
              type: "select",
              required: true,
              options: [
                { value: "PRESENT", label: "Present" },
                { value: "ABSENT", label: "Absent" },
              ].filter((o) => o.value !== modal.record.status),
            },
            { name: "reason", label: "Reason", type: "textarea", required: true, help: "Explain why the mark is wrong (at least 5 characters)." },
          ]}
          initial={{ requested_status: modal.record.status === "PRESENT" ? "ABSENT" : "PRESENT" }}
          submitLabel="Send request"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/corrections/", { record: modal.record.id, ...v });
            setModal(null);
            toast.success("Correction request sent to your HOD");
            records.reload();
          }}
        />
      )}
    </>
  );
}
