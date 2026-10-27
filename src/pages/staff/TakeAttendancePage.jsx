/*
  TakeAttendancePage - list of lectures for one date, where a teacher starts taking attendance.
  Opened by: Staff (menu: Take attendance, or the button on the dashboard).
  From here the teacher can open a lecture, cancel a draft lecture, or add an extra lecture.
  API endpoints used: GET /lectures/ (filtered by date and search), GET /assignments/ (for the Add form),
  POST /lectures/, POST /lectures/:id/cancel/.
*/
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PagedTable } from "../../components/DataTable";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/Modal";
import { PageHeader, SearchInput, StatusBadge } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useDebounce, useOptions, usePaginated } from "../../hooks/useData";
import { fmtTime, todayISO } from "../../utils/format";

export default function TakeAttendancePage() {
  // Navigation helper and toast (small message) helper.
  const navigate = useNavigate();
  const toast = useToast();
  // Filters: chosen date and search text.
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  // Wait a moment after typing (debounce), then load the lectures of that date (50 per page).
  const q = useDebounce(search);
  const list = usePaginated("/lectures/", { date, search: q }, 50);
  // Options for the Add form: this teacher's active subject + class pairs.
  const assignments = useOptions("/assignments/", (a) => ({ value: a.id, label: `${a.subject_name} · ${a.classroom_name}` }), { is_active: "true" });
  // Which popup is open (add / cancel) and the lecture it is about; null = none.
  const [modal, setModal] = useState(null);

  // Table column definitions.
  const columns = [
    // Start and end time
    { key: "time", header: "Time", className: "num", render: (l) => `${fmtTime(l.start_time)}–${fmtTime(l.end_time)}` },
    // Subject column
    { key: "subject_name", header: "Subject", render: (l) => <strong>{l.subject_name}</strong> },
    // Class column
    { key: "classroom_name", header: "Class" },
    // Present / absent counts if submitted; otherwise how many students are marked so far
    { key: "marks", header: "Present / Absent", className: "num", render: (l) => (l.status === "SUBMITTED" ? `${l.present_count} / ${l.absent_count}` : l.marked_count ? `${l.marked_count} marked` : <span className="muted">–</span>) },
    // Lecture status badge
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      // Buttons: open the lecture, and cancel it (only while it is a draft)
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div className="actions">
          <Link className="btn sm" to={`/lectures/${l.id}`}>{l.status === "DRAFT" ? "Take attendance" : "View"}</Link>
          {l.status === "DRAFT" && <button className="btn sm secondary" onClick={() => setModal({ type: "cancel", lecture: l })}>Cancel lecture</button>}
        </div>
      ),
    },
  ];

  // Page layout
  return (
    <>
      <PageHeader
        title="Take attendance"
        subtitle="Pick a date, open the lecture, mark each student Present or Absent, then submit."
        actions={<button className="btn secondary" onClick={() => setModal({ type: "add" })}>Add a lecture</button>}
      />
      {/* Search, date picker and the lectures table */}
      <div className="panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Subject or class" />
          <div className="field">
            <label htmlFor="att-date">Date</label>
            <input id="att-date" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <button className="btn secondary" onClick={() => setDate(todayISO())}>Today</button>
        </div>
        <PagedTable
          query={list}
          columns={columns}
          emptyTitle="No lectures on this date"
          emptyHint="Lectures appear here once your HOD generates them from the timetable. For an extra or rescheduled class, add one yourself."
          emptyAction={<button className="btn" onClick={() => setModal({ type: "add" })}>Add a lecture</button>}
        />
      </div>

      {/* Popup: add an extra lecture. The date starts as the chosen date. After saving, the new lecture opens. */}
      {modal?.type === "add" && (
        <FormModal
          title="Add a lecture"
          intro="Use this for extra classes or when the timetable does not list the session."
          fields={[
            { name: "teacher_subject_assignment", label: "Subject and class", type: "select", required: true, options: assignments.options, full: true },
            { name: "lecture_date", label: "Date", type: "date", required: true, max: todayISO() },
            { name: "start_time", label: "Starts", type: "time", required: true },
            { name: "end_time", label: "Ends", type: "time", required: true },
          ]}
          initial={{ lecture_date: date }}
          submitLabel="Add and open"
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            const { data } = await api.post("/lectures/", { ...v, teacher_subject_assignment: Number(v.teacher_subject_assignment) });
            setModal(null);
            navigate(`/lectures/${data.id}`);
          }}
        />
      )}
      {/* Popup: confirm cancelling a lecture; a reason is sent to the server */}
      {modal?.type === "cancel" && (
        <ConfirmDialog
          title="Cancel this lecture?"
          message={`${modal.lecture.subject_name} for ${modal.lecture.classroom_name} will be marked Cancelled and will not count as pending.`}
          confirmLabel="Cancel lecture"
          danger
          remarksLabel="Reason"
          onCancel={() => setModal(null)}
          onConfirm={async (reason) => {
            await api.post(`/lectures/${modal.lecture.id}/cancel/`, { reason });
            setModal(null);
            toast.success("Lecture cancelled");
            list.reload();
          }}
        />
      )}
    </>
  );
}
